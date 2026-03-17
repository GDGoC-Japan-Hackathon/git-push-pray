import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface AvatarViewerProps {
  url: string;
  emotion?: string; // e.g. 'joy', 'angry', 'sorrow', 'fun', 'neutral', 'thinking'
}

const AvatarModel: React.FC<AvatarViewerProps> = ({ url, emotion = 'neutral' }) => {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const { scene } = useThree();
  const targetExpressionRef = useRef('neutral');
  const currentRotations = useRef({ headPitch: 0, headYaw: 0, spineBend: 0 });

  useEffect(() => {
    let currentVrm: VRM | null = null;
    const loader = new GLTFLoader();
    
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });

    loader.load(
      url,
      (gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;
        currentVrm = loadedVrm;

        // Optimizations & standard setups for VRM
        VRMUtils.removeUnnecessaryJoints(gltf.scene);

        // カメラが +Z 側にいるため、正面を見せるには 0 度（そのまま）でOKです。
        loadedVrm.scene.rotation.y = 0;

        // --- Fix T-pose: lower arms slightly ---
        if (loadedVrm.humanoid) {
          const leftUpperArm = loadedVrm.humanoid.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = loadedVrm.humanoid.getNormalizedBoneNode('rightUpperArm');
          
          if (leftUpperArm) leftUpperArm.rotation.z = -1.2; 
          if (rightUpperArm) rightUpperArm.rotation.z = 1.2; 
        }

        // Position the model slightly lower so the face is centered better
        loadedVrm.scene.position.y = -0.5;

        setVrm(loadedVrm);
        scene.add(loadedVrm.scene);
      },
      (progress) => console.log('Loading VRM...', 100.0 * (progress.loaded / progress.total), '%'),
      (error) => console.error(error)
    );

    return () => {
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        currentVrm.dispose();
      }
    };
  }, [url, scene]);

  // Handle Emotion Updates
  useEffect(() => {
    if (!vrm || !vrm.expressionManager) return;
    
    // Simple reset function for default expressions
    const resetExpressions = () => {
      const expressions = ['happy', 'angry', 'sad', 'relaxed', 'neutral', 'surprised'];
      expressions.forEach((exp) => vrm.expressionManager?.setValue(exp, 0));
    };

    resetExpressions();

    let targetExpression = 'neutral';
    switch (emotion) {
      case 'joy':
      case 'happy': targetExpression = 'happy'; break;
      case 'angry': targetExpression = 'angry'; break;
      case 'sorrow':
      case 'confused':
      case 'sad': targetExpression = 'sad'; break;
      case 'fun':
      case 'relaxed': targetExpression = 'relaxed'; break;
      case 'thinking':
      case 'surprised': targetExpression = 'surprised'; break; // use surprised or eye closing for thinking
      case 'neutral':
      default:
        targetExpression = 'neutral';
        break;
    }

    targetExpressionRef.current = targetExpression;
  }, [emotion, vrm]);

  // Update VRM state every frame
  useFrame((state, delta) => {
    if (vrm) {
      // ------- Smoothly interpolate expressions (Blendshapes) -------
      if (vrm.expressionManager) {
        // More subtle and varied expressions by blending
        const expressionTargets: Record<string, number> = {
          happy: 0, angry: 0, sad: 0, relaxed: 0, neutral: 0, surprised: 0
        };

        // Base mappings
        if (targetExpressionRef.current === 'happy') {
          expressionTargets['happy'] = 1.0;
        } else if (targetExpressionRef.current === 'sad') {
          expressionTargets['sad'] = 0.8; // Don't make it overly dramatic
        } else if (targetExpressionRef.current === 'surprised') {
          expressionTargets['surprised'] = 0.8;
          expressionTargets['happy'] = 0.2; // A bit of a happy surprise
        } else if (targetExpressionRef.current === 'thinking') {
          expressionTargets['neutral'] = 0.5;
          expressionTargets['surprised'] = 0.2; // Slight eyes open
        } else if (targetExpressionRef.current === 'relaxed') {
          expressionTargets['relaxed'] = 1.0;
        } else if (targetExpressionRef.current === 'angry') {
           expressionTargets['angry'] = 0.8;
        } else {
          expressionTargets['neutral'] = 1.0;
        }

        const expressions = ['happy', 'angry', 'sad', 'relaxed', 'neutral', 'surprised'];
        expressions.forEach((exp) => {
          const currentVal = vrm.expressionManager!.getValue(exp) || 0;
          const targetVal = expressionTargets[exp] || 0;
          // VTuberのような滑らかな表情変化 (delta * スピード)
          const newVal = THREE.MathUtils.lerp(currentVal, targetVal, delta * 5.0);
          vrm.expressionManager!.setValue(exp, newVal);
        });
        vrm.expressionManager.update();
      }

      // ------- Body Animations based on Emotion -------
      // Idle breathing
      const t = state.clock.getElapsedTime();
      let yOffset = Math.sin(t * Math.PI * 0.5) * 0.01;
      let headPitch = 0;
      let headYaw = 0;
      let spineBend = 0;

      // Body language overrides
      switch (emotion) {
        case 'happy':
        case 'joy':
          // Bounce lightly
          yOffset += Math.abs(Math.sin(t * Math.PI * 2.0)) * 0.02;
          headPitch = Math.sin(t * Math.PI) * 0.05; // slight nodding
          break;
        case 'sad':
        case 'sorrow':
        case 'confused':
          // Slumping, looking down
          headPitch = -0.2;
          spineBend = 0.1;
          break;
        case 'surprised':
        case 'thinking':
          // Look up and tilt head slightly
          headPitch = 0.15;
          headYaw = Math.sin(t * 1.5) * 0.1; // slowly look side to side
          break;
        default:
          break;
      }

      vrm.scene.position.y = yOffset; 

      // VTuberのような滑らかな体の動き補間
      currentRotations.current.headPitch = THREE.MathUtils.lerp(currentRotations.current.headPitch, headPitch, delta * 3.0);
      currentRotations.current.headYaw = THREE.MathUtils.lerp(currentRotations.current.headYaw, headYaw, delta * 3.0);
      currentRotations.current.spineBend = THREE.MathUtils.lerp(currentRotations.current.spineBend, spineBend, delta * 3.0);

      if (vrm.humanoid) {
        const head = vrm.humanoid.getNormalizedBoneNode('head');
        const spine = vrm.humanoid.getNormalizedBoneNode('spine');

        if (head) {
          head.rotation.x = currentRotations.current.headPitch;
          head.rotation.y = currentRotations.current.headYaw;
        }
        if (spine) {
          spine.rotation.x = currentRotations.current.spineBend;
        }
      }

      // 最初の数フレームは springBoneManager をリセットして爆発を防ぎます
      if (t < 0.2 && vrm.springBoneManager) {
        vrm.springBoneManager.reset();
      }

      vrm.update(delta);
    }
  });

  return null;
}

export const AvatarCanvas: React.FC<AvatarViewerProps> = ({ url, emotion }) => {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      {/* 
        camera position: X:左右, Y:上下(大きいほど見下ろす), Z:前後(ゼロに近いほど大きく映る) 
        Yに1.2くらいを入れて胸〜顔を中心にし、Zをゼロに近づけることで腰上アップにします。
      */}
      <Canvas camera={{ position: [0, 0.5, 0.8], fov: 40 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[1, 2, -1]} intensity={2.0} />
        <Suspense fallback={null}>
          <AvatarModel url={url} emotion={emotion} />
        </Suspense>
        {/* OrbitControls を使って、ユーザーがマウスでぐるぐる回して確認できるようにします */}
        <OrbitControls
          target={[0, 1.2, 0]} /* look at the chest/face roughly */
          enablePan={false}
          enableZoom={true} // ズームを許可してバランスを整えやすくします
          maxPolarAngle={Math.PI / 2 + 0.2}
          minPolarAngle={Math.PI / 2 - 0.2}
        />
      </Canvas>
    </div>
  );
};

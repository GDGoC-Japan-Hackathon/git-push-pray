import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface AvatarModelProps {
  url: string;
  emotion?: string;
  vrmRef?: React.MutableRefObject<VRM | null>;
}

interface AvatarCanvasProps {
  url: string;
  emotion?: string;
  viewMode?: 'full' | 'face';
}

// Emotion → blendshape lookup table (8 emotions)
const EMOTION_BLENDS: Record<string, Partial<Record<string, number>>> = {
  neutral:   { neutral: 1.0 },
  happy:     { happy: 1.0 },
  excited:   { happy: 1.0, surprised: 0.4 },
  proud:     { happy: 0.6, relaxed: 0.5 },
  thinking:  { neutral: 0.6, surprised: 0.2 },
  confused:  { sad: 0.5, surprised: 0.4 },
  sad:       { sad: 0.8 },
  surprised: { surprised: 0.9, happy: 0.2 },
}

const ALL_EXPRESSIONS = ['happy', 'angry', 'sad', 'relaxed', 'neutral', 'surprised']

export const AvatarModel: React.FC<AvatarModelProps> = ({ url, emotion = 'neutral', vrmRef }) => {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const { scene } = useThree();
  const emotionRef = useRef(emotion);
  const currentRotations = useRef({ headPitch: 0, headYaw: 0, spineBend: 0 });

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    let currentVrm: VRM | null = null;
    const loader = new GLTFLoader();

    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;
        currentVrm = loadedVrm;

        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        loadedVrm.scene.rotation.y = 0;

        if (loadedVrm.humanoid) {
          const leftUpperArm = loadedVrm.humanoid.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = loadedVrm.humanoid.getNormalizedBoneNode('rightUpperArm');
          if (leftUpperArm) leftUpperArm.rotation.z = -1.2;
          if (rightUpperArm) rightUpperArm.rotation.z = 1.2;
        }

        loadedVrm.scene.position.y = -0.5;

        if (vrmRef) vrmRef.current = loadedVrm;
        setVrm(loadedVrm);
        scene.add(loadedVrm.scene);
      },
      (progress) => console.log('Loading VRM...', 100.0 * (progress.loaded / progress.total), '%'),
      (error) => console.error(error)
    );

    return () => {
      if (currentVrm) {
        if (vrmRef) vrmRef.current = null;
        scene.remove(currentVrm.scene);
      }
    };
  }, [url, scene]);

  useFrame((state, delta) => {
    if (!vrm) return;

    const em = emotionRef.current;
    const blends = EMOTION_BLENDS[em] ?? EMOTION_BLENDS.neutral;
    const lerpSpeed = em === 'surprised' ? 8.0 : 5.0;

    // Smooth blendshape interpolation
    if (vrm.expressionManager) {
      ALL_EXPRESSIONS.forEach((exp) => {
        const currentVal = vrm.expressionManager!.getValue(exp) ?? 0;
        const targetVal = blends[exp] ?? 0;
        vrm.expressionManager!.setValue(exp, THREE.MathUtils.lerp(currentVal, targetVal, delta * lerpSpeed));
      });
      vrm.expressionManager.update();
    }

    // Body animations
    const t = state.clock.getElapsedTime();
    let yOffset = Math.sin(t * Math.PI * 0.5) * 0.01;
    let headPitch = 0;
    let headYaw = 0;
    let spineBend = 0;

    switch (em) {
      case 'happy':
        yOffset += Math.abs(Math.sin(t * Math.PI * 2.0)) * 0.02;
        headPitch = Math.sin(t * Math.PI) * 0.05;
        break;
      case 'excited':
        yOffset += Math.abs(Math.sin(t * Math.PI * 3.0)) * 0.03;
        headPitch = Math.sin(t * Math.PI * 1.5) * 0.08;
        break;
      case 'proud':
        headPitch = 0.1;
        break;
      case 'thinking':
        headYaw = Math.sin(t * 1.5) * 0.1;
        break;
      case 'confused':
        headYaw = 0.15;
        break;
      case 'sad':
        headPitch = -0.2;
        spineBend = 0.1;
        break;
      case 'surprised':
        headPitch = 0.2;
        break;
    }

    vrm.scene.position.y = yOffset;

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

    if (t < 0.2 && vrm.springBoneManager) {
      vrm.springBoneManager.reset();
    }

    vrm.update(delta);
  });

  return null;
};

interface FaceCameraRigProps {
  vrmRef: React.MutableRefObject<VRM | null>;
}

function FaceCameraRig({ vrmRef }: FaceCameraRigProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 30;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame(() => {
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return;

    const headBone = vrm.humanoid.getNormalizedBoneNode('head');
    if (!headBone) return;

    const headPos = new THREE.Vector3();
    headBone.getWorldPosition(headPos);

    camera.position.set(headPos.x, headPos.y, headPos.z + 1.3);
    camera.lookAt(headPos);
  });

  return null;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ url, emotion, viewMode = 'full' }) => {
  const isFace = viewMode === 'face';
  const vrmRef = useRef<VRM | null>(null);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: isFace ? 0 : 300 }}>
      {isFace ? (
        <Canvas gl={{ alpha: true }} style={{ background: 'transparent' }}>
          <FaceCameraRig vrmRef={vrmRef} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[1, 2, -1]} intensity={2.0} />
          <Suspense fallback={null}>
            <AvatarModel url={url} emotion={emotion} vrmRef={vrmRef} />
          </Suspense>
        </Canvas>
      ) : (
        <Canvas camera={{ position: [0, 0.5, 0.8], fov: 40 }}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[1, 2, -1]} intensity={2.0} />
          <Suspense fallback={null}>
            <AvatarModel url={url} emotion={emotion} />
          </Suspense>
          <OrbitControls
            target={[0, 1.2, 0]}
            enablePan={false}
            enableRotate={true}
            enableZoom={true}
            maxPolarAngle={Math.PI / 2 + 0.2}
            minPolarAngle={Math.PI / 2 - 0.2}
          />
        </Canvas>
      )}
    </div>
  );
};

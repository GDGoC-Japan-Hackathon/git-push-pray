import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface OrderingConfig {
  type: 'ordering'
  words: string[]
  answer: number[]
}

type ExerciseConfig = OrderingConfig

interface Props {
  config: ExerciseConfig
  onInteract: (message: string) => void
}

interface WordItem {
  id: string
  word: string
  originalIndex: number
}

function SortableWord({ id, word }: { id: string; word: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none touch-none"
    >
      {word}
    </div>
  )
}

function OrderingExercise({ config, onInteract }: { config: OrderingConfig; onInteract: (msg: string) => void }) {
  const [items, setItems] = useState<WordItem[]>(() =>
    config.words.map((word, i) => ({ id: `word-${i}`, word, originalIndex: i }))
  )
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.id === active.id)
        const newIndex = prev.findIndex(i => i.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = () => {
    const userOrder = items.map(i => i.originalIndex)
    const correct = JSON.stringify(userOrder) === JSON.stringify(config.answer)
    setIsCorrect(correct)
    setSubmitted(true)
    const sentence = items.map(i => i.word).join(' ')
    onInteract(`並べ替え問題の回答: 「${sentence}」 (${correct ? '正解でした！' : '不正解でした。'})`)
  }

  return (
    <div className="my-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <p className="text-sm text-gray-600 mb-3">単語を並べ替えて正しい文を作ってください。</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-gray-50 rounded-lg mb-3 border border-dashed border-gray-300">
            {items.map(item => (
              <SortableWord key={item.id} id={item.id} word={item.word} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!submitted ? (
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          答えを送る
        </button>
      ) : (
        <p className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrect ? '正解！AIが採点しています...' : '不正解。AIが解説しています...'}
        </p>
      )}
    </div>
  )
}

export function InteractiveExercise({ config, onInteract }: Props) {
  if (config.type === 'ordering') {
    return <OrderingExercise config={config} onInteract={onInteract} />
  }
  return null
}

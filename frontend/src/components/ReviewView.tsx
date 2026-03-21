import {
  CheckCircleIcon,
  AlertTriangleIcon,
  LightbulbIcon,
  LoaderIcon,
} from "lucide-react";
import type { ReviewResult } from "../types";

interface Props {
  review: ReviewResult | null;
  isLoading: boolean;
  streamingText: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-50 border-green-200";
  if (score >= 70) return "bg-yellow-50 border-yellow-200";
  if (score >= 50) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getScoreRingColor(score: number): string {
  if (score >= 90) return "stroke-green-500";
  if (score >= 70) return "stroke-yellow-500";
  if (score >= 50) return "stroke-orange-500";
  return "stroke-red-500";
}

function getCorrectnessLabel(c: string): { label: string; className: string } {
  switch (c) {
    case "correct":
      return { label: "正確", className: "bg-green-100 text-green-700" };
    case "partially_correct":
      return { label: "一部正確", className: "bg-yellow-100 text-yellow-700" };
    case "incorrect":
      return { label: "不正確", className: "bg-red-100 text-red-700" };
    default:
      return { label: c, className: "bg-gray-100 text-gray-700" };
  }
}

function getClarityLabel(c: string): { label: string; className: string } {
  switch (c) {
    case "clear":
      return { label: "明確", className: "bg-blue-100 text-blue-700" };
    case "vague":
      return { label: "曖昧", className: "bg-yellow-100 text-yellow-700" };
    case "unclear":
      return { label: "不明確", className: "bg-red-100 text-red-700" };
    default:
      return { label: c, className: "bg-gray-100 text-gray-700" };
  }
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          className={getScoreRingColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

export function ReviewView({ review, isLoading, streamingText }: Props) {
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <LoaderIcon size={40} className="animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600 font-medium mb-2">
          レビューを生成中...
        </p>
        {streamingText && (
          <div className="mt-4 max-w-lg w-full bg-gray-50 rounded-lg p-4 text-sm text-gray-500 max-h-40 overflow-y-auto">
            <p className="whitespace-pre-wrap break-words opacity-50">
              {streamingText.slice(0, 200)}...
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-400">レビューデータがありません</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Overall Score */}
        <div
          className={`flex flex-col items-center p-6 rounded-2xl border ${getScoreBgColor(review.overall_score)}`}
        >
          <ScoreCircle score={review.overall_score} />
          <p className="mt-4 text-gray-700 text-center text-sm leading-relaxed">
            {review.summary}
          </p>
        </div>

        {/* Strengths */}
        {review.strengths && review.strengths.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-green-700 mb-3">
              <CheckCircleIcon size={18} />
              強み
            </h3>
            <ul className="space-y-2">
              {review.strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <span className="text-green-500 mt-0.5 shrink-0">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {review.weaknesses && review.weaknesses.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-orange-600 mb-3">
              <AlertTriangleIcon size={18} />
              改善点
            </h3>
            <ul className="space-y-2">
              {review.weaknesses.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <span className="text-orange-500 mt-0.5 shrink-0">!</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Topic Evaluations */}
        {review.topic_evaluations && review.topic_evaluations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">
              トピック別評価
            </h3>
            <div className="space-y-4">
              {review.topic_evaluations.map((te, i) => {
                const correctness = getCorrectnessLabel(te.correctness);
                const clarity = getClarityLabel(te.clarity);
                return (
                  <div
                    key={i}
                    className="border border-gray-100 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-800">
                        {te.topic}
                      </span>
                      <span
                        className={`text-sm font-bold ${getScoreColor(te.score)}`}
                      >
                        {te.score}点
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-700 ${
                          te.score >= 90
                            ? "bg-green-500"
                            : te.score >= 70
                              ? "bg-yellow-500"
                              : te.score >= 50
                                ? "bg-orange-500"
                                : "bg-red-500"
                        }`}
                        style={{ width: `${te.score}%` }}
                      />
                    </div>
                    <div className="flex gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${correctness.className}`}
                      >
                        {correctness.label}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${clarity.className}`}
                      >
                        {clarity.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{te.comment}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Advice */}
        {review.advice && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="flex items-center gap-2 font-semibold text-blue-700 mb-2">
              <LightbulbIcon size={18} />
              アドバイス
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              {review.advice}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

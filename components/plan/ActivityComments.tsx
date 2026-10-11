"use client";

import { useEffect, useState } from "react";
import {
  addActivityComment,
  deleteActivityComment,
  subscribeActivityComments,
} from "@/lib/activities";
import type { ActivityComment, Member } from "@/lib/types";

export function ActivityComments({
  roomId,
  activityId,
  uid,
  members = [],
  onCountChange,
}: {
  roomId: string;
  activityId: string;
  uid: string | null;
  members?: Member[];
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<ActivityComment[] | null>(null);
  const [inputBody, setInputBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMember = members.find((m) => m.id === uid);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeActivityComments(
      roomId,
      activityId,
      (list) => {
        if (!cancelled) {
          setComments(list);
          onCountChange?.(list.length);
        }
      },
      (err) => {
        if (!cancelled) setError(err.message);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId, activityId, onCountChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputBody.trim();
    if (!text || !uid) return;
    if (text.length > 500) {
      setError("ข้อความยาวเกินไป (ไม่เกิน 500 ตัวอักษร)");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await addActivityComment(
        roomId,
        activityId,
        text,
        uid,
        currentMember?.name || "เพื่อนร่วมทริป",
        currentMember?.emoji || "🐝",
      );
      setInputBody("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ส่งความคิดเห็นไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("ต้องการลบความคิดเห็นนี้ใช่หรือไม่?")) return;
    try {
      await deleteActivityComment(roomId, commentId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="border-t border-stone-100 pt-3">
        <h4 className="font-bold text-stone-800 text-[11px] mb-2">
          💬 ความคิดเห็น ({comments ? comments.length : "…"})
        </h4>

        {comments === null ? (
          <div className="py-2 text-stone-400 text-center animate-pulse">
            กำลังโหลดความคิดเห็น…
          </div>
        ) : comments.length === 0 ? (
          <div className="py-2 text-stone-400 text-center">
            ยังไม่มีความคิดเห็น มาเปิดประเด็นกันเลย!
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {comments.map((c) => {
              // ดึงข้อมูลโปรไฟล์ล่าสุดของคนเขียน ถ้าอยู่ใน members
              const author = members.find((m) => m.id === c.authorUid);
              const authorName = author?.name || c.authorName || "เพื่อนร่วมทริป";
              const authorEmoji = author?.emoji || c.authorEmoji || "🐝";
              const isMine = c.authorUid === uid;

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-stone-200/60 bg-stone-50/70 p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                      <span>{authorEmoji}</span>
                      <span>{authorName}</span>
                      {isMine && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[9px] text-amber-800 font-bold">
                          คุณ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400">
                      <span>
                        {new Date(c.createdAt).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="ลบความคิดเห็น"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-stone-700 whitespace-pre-wrap break-words leading-relaxed">
                    {c.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={inputBody}
            onChange={(e) => {
              setInputBody(e.target.value);
              setError(null);
            }}
            placeholder="พิมพ์ความคิดเห็นหรือข้อเสนอแนะ…"
            maxLength={500}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={isSubmitting || !inputBody.trim()}
            className="btn-primary !py-2 !px-3 !text-xs font-bold disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isSubmitting ? "…" : "ส่ง"}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-600">{error}</div>}
      </form>
    </div>
  );
}

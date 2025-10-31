import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';

type Props = {
  onClick: () => void;
  storageKey: string; // 페이지별 위치 저장 키
  icon?: React.ReactNode;
};

export default function FloatingHelpButton({ onClick, storageKey, icon }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(`help_pos_${storageKey}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    // 기본: 우하단 배치
    return { x: window.innerWidth - 72, y: window.innerHeight - 88 };
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let currentPos = pos;

    const clamp = (x: number, y: number) => {
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      return { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) };
    };

    const savePosition = (newPos: { x: number; y: number }) => {
      try { 
        localStorage.setItem(`help_pos_${storageKey}`, JSON.stringify(newPos)); 
        currentPos = newPos;
      } catch {}
    };

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
      e.stopPropagation();
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const { x, y } = clamp(e.clientX - offsetX, e.clientY - offsetY);
      setPos({ x, y });
    };
    
    const onMouseUp = (e: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      const { x, y } = clamp(e.clientX - offsetX, e.clientY - offsetY);
      const newPos = { x, y };
      setPos(newPos);
      savePosition(newPos);
    };

    const onTouchStart = (e: TouchEvent) => {
      dragging = true;
      const rect = el.getBoundingClientRect();
      const t = e.touches[0];
      offsetX = t.clientX - rect.left;
      offsetY = t.clientY - rect.top;
      e.preventDefault();
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const t = e.touches[0];
      const { x, y } = clamp(t.clientX - offsetX, t.clientY - offsetY);
      setPos({ x, y });
    };
    
    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      const t = e.changedTouches[0];
      const { x, y } = clamp(t.clientX - offsetX, t.clientY - offsetY);
      const newPos = { x, y };
      setPos(newPos);
      savePosition(newPos);
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onTouchStart as EventListener);
      window.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [storageKey]);

  useEffect(() => {
    // 초기 진입 시, 저장된 값이 없거나 중앙 하단에 가깝게 저장돼 있으면 우하단으로 스냅
    const clamp = (x: number, y: number) => {
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      return { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) };
    };
    const bottomRight = { x: window.innerWidth - 72, y: window.innerHeight - 88 };
    let initial = pos;
    try {
      const saved = localStorage.getItem(`help_pos_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const clamped = clamp(parsed.x ?? bottomRight.x, parsed.y ?? bottomRight.y);
        const nearCenterX = Math.abs(clamped.x - window.innerWidth / 2) < 120;
        const nearBottom = window.innerHeight - clamped.y < 160;
        if (nearCenterX && nearBottom) {
          initial = bottomRight;
          setPos(initial);
          localStorage.setItem(`help_pos_${storageKey}`, JSON.stringify(initial));
        } else if (clamped.x !== parsed.x || clamped.y !== parsed.y) {
          initial = clamped;
          setPos(initial);
          localStorage.setItem(`help_pos_${storageKey}`, JSON.stringify(initial));
        }
      } else {
        initial = bottomRight;
        setPos(initial);
        localStorage.setItem(`help_pos_${storageKey}`, JSON.stringify(initial));
      }
    } catch {
      const fallback = bottomRight;
      setPos(fallback);
    }

    const onResize = () => {
      const clamped = clamp(pos.x, pos.y);
      if (clamped.x !== pos.x || clamped.y !== pos.y) {
        setPos(clamped);
        try { localStorage.setItem(`help_pos_${storageKey}`, JSON.stringify(clamped)); } catch {}
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000, cursor: 'grab' }}
      aria-label="floating-help"
    >
      <IconButton
        aria-label="도움말"
        icon={icon || <InfoIcon />}
        colorScheme="blue"
        size="lg"
        borderRadius="full"
        boxShadow="lg"
        onClick={onClick}
      />
    </div>
  );
}



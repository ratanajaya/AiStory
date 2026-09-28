// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), state: 'idle' }));
vi.mock('@/app/book/_components/BookAudioProvider', () => ({
  useBookAudio: () => ({ manager: mocks, playback: { state: mocks.state, mode: 'segment', targetSegmentId: 's', part: null, error: null } }),
  useAudioStatus: () => ({ state: 'idle', currentTime: 0, duration: 0 }),
}));
import SegmentAudioControl from '@/app/book/_components/SegmentAudioControl';
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.state = 'idle'; });
describe('segment audio controls', () => {
  it('delegates only this segment to the shared book manager', () => {
    render(<SegmentAudioControl segmentId="s" content={'One.\n\nTwo.'} bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play segment audio' }));
    expect(mocks.play).toHaveBeenCalledWith([{ id: 's', content: 'One.\n\nTwo.' }], 'segment');
  });
  it('can stop while the first chunk is preparing', () => {
    mocks.state = 'loading';
    render(<SegmentAudioControl segmentId="s" content="Hello" bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop segment audio' })); expect(mocks.stop).toHaveBeenCalledOnce();
  });
  it('can pause while waiting for the next chunk', () => {
    mocks.state = 'loading';
    render(<SegmentAudioControl segmentId="s" content="Hello" bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause segment audio' }));
    expect(mocks.pause).toHaveBeenCalledOnce(); expect(mocks.play).not.toHaveBeenCalled();
  });
  it('resumes paused playback rather than starting a fresh job', () => {
    mocks.state = 'paused';
    render(<SegmentAudioControl segmentId="s" content="Hello" bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play segment audio' }));
    expect(mocks.resume).toHaveBeenCalledOnce(); expect(mocks.play).not.toHaveBeenCalled();
  });
});

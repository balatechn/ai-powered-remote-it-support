/**
 * WebSocket Hook
 * Real-time event handling for the frontend.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAppStore from '../stores/appStore';

const WS_URL = import.meta.env.VITE_WS_URL || '';

let socketInstance = null;

export function getSocket() {
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef(null);
  const { addNotification } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000
    });

    socketRef.current = socket;
    socketInstance = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    socket.on('device:status', (data) => {
      addNotification({
        type: data.status === 'online' ? 'success' : 'warning',
        title: `Device ${data.status}`,
        message: `Device ${data.deviceId} went ${data.status}`
      });
      window.dispatchEvent(new CustomEvent('ws:device:status', { detail: data }));
    });

    socket.on('device:added', (data) => {
      window.dispatchEvent(new CustomEvent('ws:device:added', { detail: data }));
    });

    socket.on('device:updated', (data) => {
      window.dispatchEvent(new CustomEvent('ws:device:updated', { detail: data }));
    });

    socket.on('device:removed', (data) => {
      window.dispatchEvent(new CustomEvent('ws:device:removed', { detail: data }));
    });

    socket.on('device:heartbeat', (data) => {
      window.dispatchEvent(new CustomEvent('ws:device:heartbeat', { detail: data }));
    });

    socket.on('device:alert', (data) => {
      addNotification({
        type: 'error',
        title: 'Device Alert',
        message: data.message || `Alert on device ${data.deviceId}`
      });
      window.dispatchEvent(new CustomEvent('ws:device:alert', { detail: data }));
    });

    socket.on('session:started', (data) => {
      addNotification({
        type: 'info',
        title: 'Session Started',
        message: `New ${data.protocol || ''} session on device`
      });
      window.dispatchEvent(new CustomEvent('ws:session:started', { detail: data }));
    });

    socket.on('session:ended', (data) => {
      window.dispatchEvent(new CustomEvent('ws:session:ended', { detail: data }));
    });

    socket.on('script:result', (data) => {
      addNotification({
        type: data.exit_code === 0 ? 'success' : 'error',
        title: 'Script Result',
        message: data.exit_code === 0 ? 'Script executed successfully' : 'Script execution failed'
      });
      window.dispatchEvent(new CustomEvent('ws:script:result', { detail: data }));
    });

    socket.on('log:new', (data) => {
      window.dispatchEvent(new CustomEvent('ws:log:new', { detail: data }));
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    return () => {
      socket.disconnect();
      socketInstance = null;
    };
  }, [addNotification]);

  return socketRef.current;
}

/**
 * Hook to listen for specific WebSocket events via CustomEvents
 */
export function useWSEvent(eventName, handler) {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const listener = (event) => savedHandler.current(event.detail);
    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [eventName]);
}

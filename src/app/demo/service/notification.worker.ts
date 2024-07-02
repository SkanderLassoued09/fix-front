/// <reference lib="webworker" />
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('sendDitoDiagnostique', (message: string) => {
    const data = {
        event: 'sendDitoDiagnostique',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('reminder', (message: string) => {
    const data = {
        event: 'reminder',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

addEventListener('message', ({ data }) => {
    if (data === 'start') {
        console.log('Worker started');
    }
});

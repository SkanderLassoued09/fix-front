/// <reference lib="webworker" />
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('reminder', (message: string) => {
    console.log('Received reminder from server:', message);
    postMessage(message); // Send the message to the main thread
});

addEventListener('message', ({ data }) => {
    if (data === 'start') {
        console.log('Worker started');
    }
});

/// <reference lib="webworker" />
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {});

socket.on('sendDitoDiagnostique', (message: string) => {
    const data = {
        event: 'sendDitoDiagnostique',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('updateTicket', (message: string) => {
    const data = {
        event: 'updateTicket',
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

socket.on('confirmAllComposant', (message: string) => {
    const data = {
        event: 'confirmAllComposant',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('sendNotifcationToAdmins', (message: string) => {
    const data = {
        event: 'sendNotifcationToAdmins',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('confirmAllComposant', (message: string) => {
    const data = {
        event: 'confirmAllComposant',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('sendComponentToCoordinatorFromMagasin', (message: string) => {
    const data = {
        event: 'sendComponentToCoordinatorFromMagasin',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

addEventListener('message', ({ data }) => {
    if (data === 'start') {
    }
});

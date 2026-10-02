const net = require('net');

const socket = new net.Socket();

socket.setTimeout(5000);

socket.connect(4370, '192.168.1.235', () => {
    console.log('✅ Conectado al reloj');
    socket.destroy();
});

socket.on('timeout', () => {
    console.log('⏰ Timeout');
    socket.destroy();
});

socket.on('error', (err) => {
    console.log('❌ Error:', err.message);
});

socket.on('close', () => {
    console.log('🔌 Conexión cerrada');
});
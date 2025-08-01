const { setupRoomHandlers } = require('./roomHandlers');
const { setupShopHandlers } = require('./shopHandlers');

// ฟังก์ชันหลักสำหรับตั้งค่า socket handlers
const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    setupRoomHandlers(io, socket);
    setupShopHandlers(io, socket);
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

module.exports = { setupSocketHandlers }; 
const { setupRoomHandlers } = require('./roomHandlers');
const { setupShopHandlers } = require('./shopHandlers');
const { setupFoodHandlers } = require('./foodHandlers');

// ฟังก์ชันหลักสำหรับตั้งค่า socket handlers
const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    setupRoomHandlers(io, socket);
    setupShopHandlers(io, socket);
    setupFoodHandlers(io, socket);
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

module.exports = { setupSocketHandlers }; 
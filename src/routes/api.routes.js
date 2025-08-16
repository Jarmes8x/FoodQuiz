const express = require('express');
const router = express.Router();
const { usersDB } = require('../database/dbConfig');

// API endpoint สำหรับดึงรายชื่อผู้เล่นในห้อง
router.get('/room-players/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    
    const players = await new Promise((resolve, reject) => {
      usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json(players);
    
  } catch (error) {
    console.error('API: Error fetching players:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้เล่น' });
  }
});

// API endpoint สำหรับดึงสถานะห้อง
router.get('/room-status/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    
    const room = await new Promise((resolve, reject) => {
      usersDB.get('SELECT id, name, status, creator_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!room) {
      return res.status(404).json({ error: 'ไม่พบห้อง' });
    }
    
    res.json({
      id: room.id,
      name: room.name,
      status: room.status,
      creator_id: room.creator_id
    });
    
  } catch (error) {
    console.error('API: Error fetching room status:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงสถานะห้อง' });
  }
});

// API endpoint สำหรับจัดการการออกจากห้อง
router.post('/player-leave', express.json(), async (req, res) => {
  try {
    // Handle both JSON and string data from sendBeacon
    let body = req.body;
    
    // If body is undefined or null, return error
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    // If body is a string (from sendBeacon), try to parse it
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
        console.log('API: Successfully parsed string body:', body);
      } catch (parseError) {
        console.error('API: Failed to parse request body:', parseError);
        return res.status(400).json({ error: 'Invalid request body format' });
      }
    }
    
    // Ensure body is an object
    if (typeof body !== 'object' || body === null) {
      console.error('API: Body is not an object:', body);
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    
    const { roomId, userId, action } = body;
    
    // Validate required fields
    if (!roomId || !userId || !action) {
      console.error('API: Missing required fields:', { roomId, userId, action });
      return res.status(400).json({ error: 'Missing required fields: roomId, userId, action' });
    }
    
    if (action === 'leave_room') {
      // อัปเดตสถานะเป็นออฟไลน์
      await new Promise((resolve, reject) => {
        usersDB.run('UPDATE room_players SET is_online = 0 WHERE room_id = ? AND user_id = ?', [roomId, userId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // แจ้งผู้เล่นอื่นๆ ผ่าน socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(`room_${roomId}`).emit('user_left', { user: { id: userId, name: 'Unknown' } });
        
        // อัปเดตรายชื่อผู้เล่น
        const players = await new Promise((resolve, reject) => {
          usersDB.all('SELECT users.id, users.name, room_players.score, room_players.is_owner FROM room_players JOIN users ON room_players.user_id = users.id WHERE room_players.room_id = ? AND room_players.is_online = 1', [roomId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
        
        io.to(`room_${roomId}`).emit('player_list_updated', { roomId, players });
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('API: Error handling player leave:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการจัดการการออกจากห้อง' });
  }
});

// Test endpoint
router.post('/test', express.json(), (req, res) => {
  console.log('Test endpoint - Request body:', req.body);
  res.json({ success: true, body: req.body });
});

module.exports = router; 
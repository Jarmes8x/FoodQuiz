const usersDB = require('./dbConfig');

// ข้อมูลวัตถุดิบตัวอย่าง (ตรงกับชื่อไฟล์รูปภาพ)
const ingredients = [
  { name: 'หมู', price: 5, image_file: '11.png' },
  { name: 'กระเทียม', price: 3, image_file: '13.png' },
  { name: 'พริก', price: 8, image_file: '14.png' },
  { name: 'ใบกะเพรา', price: 12, image_file: '15.png' },
  { name: 'ใบโหระพา', price: 10, image_file: '' },
  { name: 'มะเขือเทศ', price: 15, image_file: '16.png' },
  { name: 'หัวหอมใหญ่', price: 4, image_file: '13.png' },
  { name: 'มะนาว', price: 3, image_file: '12.png' },
  { name: 'หอมแดง', price: 2, image_file: '17.png' },
  { name: 'ต้นหอม', price: 2, image_file: '18.png' },
  { name: 'แครอท', price: 1, image_file: '24.png' },
  { name: 'ผักกาด', price: 2, image_file: '19.png' },
  { name: 'ไข่', price: 3, image_file: '20.png' },
  { name: 'ไก่', price: 2, image_file: '22.png' },
  { name: 'กุ้ง', price: 1, image_file: '21.png' },
  { name: 'ฟักทอง', price: 6, image_file: '' },
  { name: 'เห็ด', price: 7, image_file: '23.png' },
];

// ข้อมูลสูตรอาหารตัวอย่าง
const meals = [
  { name: 'กะเพราหมูสับ', description: 'กะเพราหมูสับแบบไทยแท้' },
  { name: 'ข้าวผัดรถไฟ', description: 'ข้าวผัดรถไฟรสชาติเข้มข้น' },
  { name: 'ส้มตำ', description: 'ส้มตำไทยรสชาติเปรี้ยวหวาน' },
  { name: 'ผัดเปรี้ยวหวาน', description: 'ผัดเปรี้ยวหวานหมูสับ' },
  { name: 'แกงจืดหมูสับ', description: 'แกงจืดหมูสับผักบุ้ง' },
  { name: 'หมูสับผัดไข่', description: 'หมูสับผัดไข่แบบไทย' },
  { name: 'ไข่ตุ๋นกุ้ง', description: 'ไข่ตุ๋นกุ้งนุ่มนวล' },
  { name: 'น้ำพริกอ่องหมูสับ', description: 'น้ำพริกอ่องหมูสับ' },
  { name: 'ยำกุ้งสุก', description: 'ยำกุ้งสุกรสชาติแซ่บ' },
  { name: 'ไข่เจียวทรงเครื่อง', description: 'ไข่เจียวทรงเครื่องแบบไทย' }
];

// ข้อมูลความสัมพันธ์ระหว่างอาหารและวัตถุดิบ (สูตรอาหารจริง)
const mealIngredients = [
  { meal: 'กะเพราหมูสับ', ingredients: ['หมูสับ', 'พริก', 'กระเทียม', 'หอมแดง', 'น้ำมัน', 'น้ำปลา'] },
  { meal: 'ข้าวผัดรถไฟ', ingredients: ['ข้าว', 'ไข่', 'หอมแดง', 'กระเทียม', 'น้ำมัน', 'น้ำปลา'] },
  { meal: 'ส้มตำ', ingredients: ['มะเขือเทศ', 'มะนาว', 'พริก', 'น้ำปลา', 'น้ำตาล'] },
  { meal: 'ผัดเปรี้ยวหวาน', ingredients: ['หมูสับ', 'มะเขือเทศ', 'หอมแดง', 'น้ำมัน', 'น้ำปลา', 'น้ำตาล'] },
  { meal: 'แกงจืดหมูสับ', ingredients: ['หมูสับ', 'ผักบุ้ง', 'หอมแดง', 'กระเทียม', 'เกลือ'] },
  { meal: 'หมูสับผัดไข่', ingredients: ['หมูสับ', 'ไข่', 'หอมแดง', 'น้ำมัน', 'น้ำปลา'] },
  { meal: 'ไข่ตุ๋นกุ้ง', ingredients: ['ไข่', 'กุ้ง', 'หอมแดง', 'เกลือ'] },
  { meal: 'น้ำพริกอ่องหมูสับ', ingredients: ['หมูสับ', 'พริก', 'กระเทียม', 'หอมแดง', 'น้ำมัน'] },
  { meal: 'ยำกุ้งสุก', ingredients: ['กุ้ง', 'มะเขือเทศ', 'หอมแดง', 'มะนาว', 'น้ำปลา'] },
  { meal: 'ไข่เจียวทรงเครื่อง', ingredients: ['ไข่', 'หอมแดง', 'น้ำมัน', 'เกลือ'] }
];

// ฟังก์ชันเพิ่มข้อมูลวัตถุดิบ
const seedIngredients = () => {
  ingredients.forEach(ingredient => {
    usersDB.run('INSERT OR IGNORE INTO ingredient (name, price, image_file) VALUES (?, ?, ?)', 
      [ingredient.name, ingredient.price, ingredient.image_file], (err) => {
      if (err) {
        console.error('Error seeding ingredient:', err);
      } 
    });
  });
};

// ฟังก์ชันเพิ่มข้อมูลสูตรอาหาร
const seedMeals = () => {
  meals.forEach(meal => {
    usersDB.run('INSERT OR IGNORE INTO meal (name, description) VALUES (?, ?)', 
      [meal.name, meal.description], function(err) {
      if (err) {
        console.error('Error seeding meal:', err);
      } else {
        // เพิ่มความสัมพันธ์ระหว่างอาหารและวัตถุดิบ
        const mealId = this.lastID;
        mealIngredients.forEach(mi => {
          if (mi.meal === meal.name) {
            mi.ingredients.forEach(ingredient => {
              usersDB.run('INSERT OR IGNORE INTO meal_ingredient (meal_id, ingredient) VALUES (?, ?)', 
                [mealId, ingredient], (err2) => {
                if (err2) {
                  console.error('Error seeding meal_ingredient:', err2);
                }
              });
            });
          }
        });
      }
    });
  });
};

// ฟังก์ชันหลักสำหรับเพิ่มข้อมูลตัวอย่าง
const seedDatabase = () => {
  console.log('Starting database seeding...');
  
  // เพิ่มข้อมูลวัตถุดิบ
  seedIngredients();
  
  // เพิ่มข้อมูลสูตรอาหาร
  seedMeals();
  
  console.log('Database seeding completed!');
};

// เรียกใช้ฟังก์ชันเพิ่มข้อมูลตัวอย่าง
seedDatabase();

module.exports = { seedDatabase }; 
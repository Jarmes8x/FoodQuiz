const usersDB = require('./dbConfig');

// ข้อมูลวัตถุดิบตัวอย่าง (ตรงกับชื่อไฟล์รูปภาพ)
const ingredients = [
  { name: 'หมู', price: 3, image_file: '11.png' },
  { name: 'กระเทียม', price: 3, image_file: '13.png' },
  { name: 'พริก', price: 3, image_file: '14.png' },
  { name: 'มะเขือเทศ', price: 4, image_file: '16.png' },
  { name: 'หอมแดง', price: 4, image_file: '17.png' },
  { name: 'ไข่', price: 4, image_file: '20.png' },
  { name: 'กุ้ง', price: 5, image_file: '21.png' },
  { name: 'มะนาว', price: 4, image_file: '12.png' },
  { name: 'ต้นหอม', price: 2, image_file: '18.png' },
  { name: 'หัวหอมใหญ่', price: 2, image_file: '13.png' },
  { name: 'ผักกาด', price: 2, image_file: '19.png' },
  { name: 'ฟักทอง', price: 6, image_file: '25.png' },
  { name: 'เห็ด', price: 6, image_file: '23.png' },
  { name: 'ใบกะเพรา', price: 10, image_file: '15.png' }, 
  { name: 'ใบโหระพา', price: 10, image_file: '26.png' }  
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
  { meal: 'กะเพราหมูสับ', ingredients: ['หมู', 'กระเทียม', 'พริก', 'ใบกะเพรา', 'หัวหอมใหญ่'] },
  { meal: 'ข้าวผัดรถไฟ', ingredients: ['ข้าว', 'ไข่', 'กระเทียม', 'มะเขือเทศ', 'หมู'] },
  { meal: 'ส้มตำ', ingredients: ['มะละกอ', 'มะเขือเทศ', 'มะนาว', 'พริก', 'กระเทียม'] },
  { meal: 'ผัดเปรี้ยวหวาน', ingredients: ['แตงกวา', 'มะเขือเทศ', 'ไข่', 'หมู', 'กระเทียม'] },
  { meal: 'แกงจืดหมูสับ', ingredients: ['หมู', 'แครอท', 'ผักกาด', 'ต้นหอม', 'กระเทียม'] },
  { meal: 'หมูสับผัดไข่', ingredients: ['หมู', 'ไข่', 'ต้นหอม', 'กระเทียม', 'หัวหอมใหญ่'] },
  { meal: 'ไข่ตุ๋นกุ้ง', ingredients: ['ไข่', 'กุ้ง', 'แครอท', 'เห็ด', 'ต้นหอม'] },
  { meal: 'น้ำพริกอ่องหมูสับ', ingredients: ['หมู', 'พริก', 'กระเทียม', 'มะนาว', 'หอมแดง'] },
  { meal: 'ยำกุ้งสุก', ingredients: ['กุ้ง', 'มะนาว', 'ต้นหอม', 'กระเทียม', 'พริก'] },
  { meal: 'ไข่เจียวทรงเครื่อง', ingredients: ['ไข่', 'แครอท', 'ใบโหระพา', 'พริก', 'กุ้ง'] }
];

// ฟังก์ชันเพิ่มข้อมูลวัตถุดิบ
const seedIngredients = () => {
  ingredients.forEach(ingredient => {
const seedIngredients = () => {
  usersDB.serialize(() => {
    ingredients.forEach(ingredient => {
      usersDB.run('INSERT OR IGNORE INTO ingredient (name, price, image_file) VALUES (?, ?, ?)', 
        [ingredient.name, ingredient.price, ingredient.image_file], (err) => {
        if (err) {
          console.error('Error seeding ingredient:', err);
        } 
      });
    });
  });
};
  });
};

// ฟังก์ชันเพิ่มข้อมูลสูตรอาหาร
const seedMeals = () => {
const seedMeals = () => {
  usersDB.serialize(() => {
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
  });
};
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
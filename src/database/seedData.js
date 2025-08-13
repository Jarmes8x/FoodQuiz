const usersDB = require('./dbConfig');

// ข้อมูลวัตถุดิบตัวอย่าง (ตรงกับชื่อไฟล์รูปภาพ)
const ingredients = [
  { name: 'หมู', price: 15, image_file: '11.png' },
  { name: 'กระเทียม', price: 10, image_file: '13.png' },
  { name: 'พริก', price: 10, image_file: '14.png' },
  { name: 'มะเขือเทศ', price: 10, image_file: '16.png' },
  { name: 'หอม', price: 10, image_file: '17.png' },
  { name: 'ไข่', price: 15, image_file: '20.png' },
  { name: 'กุ้ง', price: 15, image_file: '21.png' },
  { name: 'มะนาว', price: 10, image_file: '12.png' },
  { name: 'ต้นหอม', price: 10, image_file: '18.png' },
  { name: 'ผักกาด', price: 10, image_file: '19.png' },
  { name: 'ฟักทอง', price: 10, image_file: '25.png' },
  { name: 'เห็ด', price: 10, image_file: '23.png' },
  { name: 'ใบกะเพรา', price: 10, image_file: '15.png' }, 
  { name: 'ใบโหระพา', price: 10, image_file: '26.png' } ,
  { name: 'แครอท', price: 10, image_file: '24.png' }, 
  { name: 'ไก่', price: 15, image_file: '22.png' },
  { name: 'หอมแดง', price: 10, image_file: '28.png' },
  { name: 'ข้าว', price: 15, image_file: '29.png' },
  { name: 'แตงกวา', price: 10, image_file: '30.png' },
  { name: 'มะละกอ', price: 15, image_file: '31.png' }

];

// ข้อมูลสูตรอาหารตัวอย่าง
const meals = [
  { name: 'กะเพราหมูสับ', description: 'กะเพราหมูสับแบบไทยแท้', image_file: '1.png' },
  { name: 'ข้าวผัดรถไฟ', description: 'ข้าวผัดรถไฟรสชาติเข้มข้น', image_file: '2.png' },
  { name: 'ส้มตำ', description: 'ส้มตำไทยรสชาติเปรี้ยวหวาน', image_file: '3.png' },
  { name: 'ผัดเปรี้ยวหวาน', description: 'ผัดเปรี้ยวหวานหมูสับ', image_file: '4.png' },
  { name: 'แกงจืดหมูสับ', description: 'แกงจืดหมูสับผักบุ้ง', image_file: '5.png' },
  { name: 'หมูสับผัดไข่', description: 'หมูสับผัดไข่แบบไทย', image_file: '6.png' },
  { name: 'ไข่ตุ๋นกุ้ง', description: 'ไข่ตุ๋นกุ้งนุ่มนวล', image_file: '7.png' },
  { name: 'น้ำพริกอ่องหมูสับ', description: 'น้ำพริกอ่องหมูสับ', image_file: '8.png' },
  { name: 'ยำกุ้งสุก', description: 'ยำกุ้งสุกรสชาติแซ่บ', image_file: '9.png' },
  { name: 'ไข่เจียวทรงเครื่อง', description: 'ไข่เจียวทรงเครื่องแบบไทย', image_file: '10.png' }
];

// ข้อมูลความสัมพันธ์ระหว่างอาหารและวัตถุดิบ (สูตรอาหารจริง)
const mealIngredients = [
  { meal: 'กะเพราหมูสับ', ingredients: ['หมู', 'กระเทียม', 'พริก', 'ใบกะเพรา', 'หอม'] },
  { meal: 'ข้าวผัดรถไฟ', ingredients: ['ข้าว', 'ไข่', 'กระเทียม', 'มะเขือเทศ', 'หมู'] },
  { meal: 'ส้มตำ', ingredients: ['มะละกอ', 'มะเขือเทศ', 'มะนาว', 'พริก', 'กระเทียม'] },
  { meal: 'ผัดเปรี้ยวหวาน', ingredients: ['แตงกวา', 'มะเขือเทศ', 'ไข่', 'หมู', 'กระเทียม'] },
  { meal: 'แกงจืดหมูสับ', ingredients: ['หมู', 'แครอท', 'ผักกาด', 'ต้นหอม', 'กระเทียม'] },
  { meal: 'หมูสับผัดไข่', ingredients: ['หมู', 'ไข่', 'ต้นหอม', 'กระเทียม', 'หอม'] },
  { meal: 'ไข่ตุ๋นกุ้ง', ingredients: ['ไข่', 'กุ้ง', 'แครอท', 'เห็ด', 'ต้นหอม'] },
  { meal: 'น้ำพริกอ่องหมูสับ', ingredients: ['หมู', 'พริก', 'กระเทียม', 'มะนาว', 'หอมแดง'] },
  { meal: 'ยำกุ้งสุก', ingredients: ['กุ้ง', 'มะนาว', 'ต้นหอม', 'กระเทียม', 'พริก'] },
  { meal: 'ไข่เจียวทรงเครื่อง', ingredients: ['ไข่', 'แครอท', 'ใบโหระพา', 'พริก', 'กุ้ง'] }
];

// ฟังก์ชันเพิ่มข้อมูลวัตถุดิบ
const seedIngredients = () => {
  return new Promise((resolve, reject) => {
    const { usersDB } = require('./dbConfig');
    usersDB.serialize(() => {
      let completed = 0;
      const total = ingredients.length;
      
      ingredients.forEach(ingredient => {
        usersDB.run('INSERT OR IGNORE INTO ingredient (name, price, image_file) VALUES (?, ?, ?)', 
          [ingredient.name, ingredient.price, ingredient.image_file], function(err) {
          if (err) {
            console.error('Error seeding ingredient:', err);
            reject(err);
          } else {
            console.log(`✓ Inserted ingredient: ${ingredient.name}`);
            completed++;
            if (completed === total) {
              resolve();
            }
          }
        });
      });
    });
  });
};

// ฟังก์ชันเพิ่มข้อมูลสูตรอาหาร
const seedMeals = () => {
  return new Promise((resolve, reject) => {
    const { usersDB } = require('./dbConfig');
    usersDB.serialize(() => {
      let completed = 0;
      const total = meals.length;
      
      meals.forEach(meal => {
        usersDB.run('INSERT OR IGNORE INTO meal (name, description, image_file) VALUES (?, ?, ?)', 
          [meal.name, meal.description, meal.image_file], function(err) {
          if (err) {
            console.error('Error seeding meal:', err);
            reject(err);
          } else {
            console.log(`✓ Inserted meal: ${meal.name}`);
            // เพิ่มความสัมพันธ์ระหว่างอาหารและวัตถุดิบ
            const mealId = this.lastID;
            const mealIngredient = mealIngredients.find(mi => mi.meal === meal.name);
            
            if (mealIngredient) {
              let ingredientCompleted = 0;
              const totalIngredients = mealIngredient.ingredients.length;
              
              mealIngredient.ingredients.forEach(ingredient => {
                usersDB.run('INSERT OR IGNORE INTO meal_ingredient (meal_id, ingredient) VALUES (?, ?)', 
                  [mealId, ingredient], (err2) => {
                  if (err2) {
                    console.error('Error seeding meal_ingredient:', err2);
                  } else {
                    console.log(`  ✓ Added ingredient ${ingredient} to ${meal.name}`);
                  }
                  
                  ingredientCompleted++;
                  if (ingredientCompleted === totalIngredients) {
                    completed++;
                    if (completed === total) {
                      resolve();
                    }
                  }
                });
              });
            } else {
              completed++;
              if (completed === total) {
                resolve();
              }
            }
          }
        });
      });
    });
  });
};

// ฟังก์ชันหลักสำหรับเพิ่มข้อมูลตัวอย่าง
const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...');
  
  try {
    // เพิ่มข้อมูลวัตถุดิบ
    console.log('📦 Seeding ingredients...');
    await seedIngredients();
    console.log('✅ Ingredients seeded successfully!');
    
    // เพิ่มข้อมูลสูตรอาหาร
    console.log('🍽️  Seeding meals...');
    await seedMeals();
    console.log('✅ Meals seeded successfully!');
    
    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
  }
};

// เรียกใช้ฟังก์ชันเพิ่มข้อมูลตัวอย่าง (ถ้าไฟล์นี้รันโดยตรง)
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedIngredients, seedMeals }; 
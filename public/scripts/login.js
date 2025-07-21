// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
    const nameInput = document.getElementById('name');
    const loginForm = document.querySelector('.login-form');
    const loginBtn = document.querySelector('.login-btn');
    
    // Auto focus on name input
    nameInput.focus();
    
    // Form validation
    loginForm.addEventListener('submit', function(e) {
        const name = nameInput.value.trim();
        
        if (name.length < 2) {
            e.preventDefault();
            showError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
            return false;
        }
        
        if (name.length > 50) {
            e.preventDefault();
            showError('ชื่อต้องไม่เกิน 50 ตัวอักษร');
            return false;
        }
        
        // Show loading state
        loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
        loginBtn.disabled = true;
    });
    
    // Real-time validation
    nameInput.addEventListener('input', function() {
        const name = this.value.trim();
        clearError();
        
        if (name.length > 0 && name.length < 2) {
            showError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
        } else if (name.length > 50) {
            showError('ชื่อต้องไม่เกิน 50 ตัวอักษร');
        }
    });
    
    // Enter key submit
    nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit', { bubbles: true }));
        }
    });
    
    // Animation effects
    const loginCard = document.querySelector('.login-card');
    
    // Fade in animation
    setTimeout(() => {
        loginCard.style.opacity = '1';
        loginCard.style.transform = 'translateY(0)';
    }, 100);
    
    // Initial styles for animation
    loginCard.style.opacity = '0';
    loginCard.style.transform = 'translateY(20px)';
    loginCard.style.transition = 'all 0.5s ease';
});

function showError(message) {
    clearError();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const form = document.querySelector('.login-form');
    form.insertBefore(errorDiv, form.firstChild);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        clearError();
    }, 5000);
}

function clearError() {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
}

// Add floating animation to login card
function addFloatingAnimation() {
    const loginCard = document.querySelector('.login-card');
    let direction = 1;
    
    setInterval(() => {
        const currentTransform = loginCard.style.transform;
        const yOffset = direction * 2;
        
        if (currentTransform.includes('translateY(0')) {
            loginCard.style.transform = `translateY(${yOffset}px)`;
        } else {
            loginCard.style.transform = 'translateY(0px)';
        }
        
        direction *= -1;
    }, 2000);
}

// Initialize floating animation after page load
window.addEventListener('load', addFloatingAnimation);


//  // เพิ่ม array เก็บ url ของหลายๆ ไอคอน
// const iconUrls = [
//     'https://www.pngbie.com/assets/images/icon/Pngbie-%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%9F%E0%B8%A3%E0%B8%B5-20230919182134.png',
//     'https://e7.pngegg.com/pngimages/299/589/png-clipart-red-tomatoes-cherry-tomato-food-salad-tomato-natural-foods-fitness-thumbnail.png',
//      'https://e7.pngegg.com/pngimages/809/463/png-clipart-white-garlic-with-cloves-garlic-vinaigrette-garlic-image-file-formats-food-thumbnail.png'
// ];


// function createFallingIcon() {
//     const icon = document.createElement('img');
//     icon.src = iconUrls[Math.floor(Math.random() * iconUrls.length)];
//     icon.className = 'icon-fall';
//     icon.style.left = Math.random() * (window.innerWidth - 32) + 'px';

//     // กำหนดตำแหน่งเริ่มต้นก่อน
//     icon.style.top = '-50px';

//     document.body.appendChild(icon);

//     const duration = Math.random() * 3 + 2; // 2-5 วินาที
//     icon.style.transitionDuration = duration + 's';

//     // ให้มันเริ่ม "ตก"
//     setTimeout(() => {
//         icon.style.top = window.innerHeight + 'px';
//     }, 10);

//     // ลบทิ้งเมื่อจบ transition
//     setTimeout(() => {
//         icon.remove();
//     }, duration * 1000);
// }
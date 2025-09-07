// auth.js (مبسط ومصَحح)
import { 
  auth, database, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged,
  ref, set, get, query, orderByChild, equalTo
} from './firebase.js';

// عناصر DOM
const authTabs = document.querySelector('.auth-tabs');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

// تغيير علامات التوثيق
if (authTabs) {
    authTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            if (e.target.dataset.tab === 'login') {
                loginForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
            }
            
            // إخفاء أي رسائل سابقة
            hideAuthMessage();
        }
    });
}

// تسجيل الدخول
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            showAuthMessage('يرجى ملء جميع الحقول', 'error');
            return;
        }
        
        try {
            showAuthMessage('جاري تسجيل الدخول...', 'info');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            showAuthMessage('تم تسجيل الدخول بنجاح!', 'success');
            
            // الانتقال إلى الصفحة الرئيسية بعد تسجيل الدخول
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            showAuthMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
}

// إنشاء حساب
if (signupBtn) {
    signupBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const phone = document.getElementById('signup-phone').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const address = document.getElementById('signup-address').value;
        const referralCodeInput = document.getElementById('signup-referral')?.value || '';
        
        if (!name || !phone || !email || !password) {
            showAuthMessage('يرجى ملء جميع الحقول الإلزامية', 'error');
            return;
        }
        
        try {
            showAuthMessage('جاري إنشاء الحساب...', 'info');
            
            let referredBy = null;
            
            // إذا كان هناك رمز إحالة، البحث عن المستخدم الذي يملكه
            if (referralCodeInput) {
                referredBy = await getUserIdByReferralCode(referralCodeInput);
                if (!referredBy) {
                    showAuthMessage('رمز الإحالة غير صحيح', 'error');
                    return;
                }
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // إنشاء رمز إحالة فريد
            const referralCode = generateReferralCode(user.uid);
            
            // حفظ بيانات المستخدم الإضافية في قاعدة البيانات
            const userData = {
                name: name,
                phone: phone,
                email: email,
                address: address,
                referralCode: referralCode,
                referralCount: 0,
                joinDate: new Date().toISOString(),
                isAdmin: false,
                referredBy: referredBy
            };
            
            // حفظ بيانات المستخدم
            await set(ref(database, 'users/' + user.uid), userData);
            
            // حفظ رمز الإحالة للبحث السريع
            await set(ref(database, 'referralCodes/' + referralCode), user.uid);
            
            // إذا كان هناك مستخدم أحاله، تحديث سجلات الإحالة
            if (referredBy) {
                await updateReferrerData(referredBy, user.uid, userData);
            }
            
            showAuthMessage('تم إنشاء الحساب بنجاح!', 'success');
            
            // الانتقال إلى الصفحة الرئيسية بعد إنشاء الحساب
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            showAuthMessage(getAuthErrorMessage(error.code), 'error');
        }
    });
}

// استمع لتغير حالة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('auth.html')) {
        // إذا كان المستخدم مسجلاً بالفعل، انتقل إلى الصفحة الرئيسية
        window.location.href = 'index.html';
    }
});

// وظائف مساعدة
function showAuthMessage(message, type) {
    if (!authMessage) return;
    
    authMessage.textContent = message;
    authMessage.className = '';
    authMessage.classList.add(type + '-message');
    authMessage.classList.remove('hidden');
    
    // إخفاء الرسالة بعد 5 ثواني
    setTimeout(hideAuthMessage, 5000);
}

function hideAuthMessage() {
    if (authMessage) {
        authMessage.classList.add('hidden');
    }
}

function getAuthErrorMessage(code) {
    switch(code) {
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح';
        case 'auth/user-disabled': return 'هذا الحساب معطل';
        case 'auth/user-not-found': return 'لا يوجد حساب مرتبط بهذا البريد الإلكتروني';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة';
        case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مستخدم بالفعل';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة (يجب أن تحتوي على 6 أحرف على الأقل)';
        default: return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
    }
}

// إنشاء رمز إحالة فريد
function generateReferralCode(userId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + userId.substring(0, 2).toUpperCase();
}

// الحصول على معرف المستخدم من خلال رمز الإحالة
async function getUserIdByReferralCode(referralCode) {
    try {
        const referralCodeRef = ref(database, `referralCodes/${referralCode}`);
        const snapshot = await get(referralCodeRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.error("Error getting user by referral code:", error);
        return null;
    }
}

// تحديث بيانات المُحيل
async function updateReferrerData(referrerId, newUserId, userData) {
    try {
        // تحديث سجل الإحالات للمستخدم الذي أحال
        const referralData = {
            referredUserId: newUserId,
            name: userData.name,
            email: userData.email,
            timestamp: new Date().toISOString(),
            status: 'completed',
            level: 1 // المستوى المباشر
        };
        
        await set(ref(database, `userReferrals/${referrerId}/${newUserId}`), referralData);
        
        // زيادة عداد الإحالات للمستخدم الذي أحال
        const userRef = ref(database, 'users/' + referrerId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const currentCount = userData.referralCount || 0;
            
            await set(ref(database, `users/${referrerId}/referralCount`), currentCount + 1);
        }
    } catch (error) {
        console.error("Error updating referrer data:", error);
    }
                  }

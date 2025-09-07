// profile.js (محدث)
import { 
    auth, database, signOut,
    ref, onValue,
    onAuthStateChanged
} from './firebase.js';
import { getUserReferrals } from './referral-system.js';

// عناصر DOM
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userPhone = document.getElementById('user-phone');
const userAddress = document.getElementById('user-address');
const joinDate = document.getElementById('join-date');
const logoutBtn = document.getElementById('logout-btn');
const adminIcon = document.getElementById('admin-icon');
const referralCount = document.getElementById('referral-count');
const referralCode = document.getElementById('referral-code');
const referralLink = document.getElementById('referral-link');

// تحميل بيانات المستخدم عند بدء التحميل
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});

// التحقق من حالة المصادقة
function checkAuthState() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            // توجيه إلى صفحة التسجيل إذا لم يكن المستخدم مسجلاً
            window.location.href = 'auth.html';
            return;
        }
        
        // تحميل بيانات المستخدم الحالي
        loadUserData(user.uid);
        
        // تحميل بيانات الإحالات
        loadReferralData(user.uid);
    });
}

// تحميل بيانات المستخدم
function loadUserData(userId) {
    const userRef = ref(database, 'users/' + userId);
    onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            
            // عرض بيانات المستخدم
            userName.textContent = userData.name || 'غير محدد';
            userEmail.textContent = userData.email || 'غير محدد';
            userPhone.textContent = userData.phone || 'غير محدد';
            userAddress.textContent = userData.address || 'غير محدد';
            
            // عرض تاريخ الانضمام
            if (userData.joinDate) {
                const date = new Date(userData.joinDate);
                joinDate.textContent = date.toLocaleDateString('ar-SA');
            } else {
                joinDate.textContent = 'غير محدد';
            }
            
            // عرض رمز الإحالة
            referralCode.textContent = userData.referralCode || 'غير متوفر';
            
            // إنشاء رابط الإحالة
            if (userData.referralCode) {
                referralLink.value = `${window.location.origin}/auth.html?ref=${userData.referralCode}`;
            }
            
            // إظهار أيقونة الإدارة إذا كان المستخدم مشرفاً
            if (userData.isAdmin) {
                adminIcon.style.display = 'flex';
            }
        } else {
            // بيانات المستخدم غير موجودة
            userName.textContent = 'بيانات غير متاحة';
            userEmail.textContent = 'بيانات غير متاحة';
            userPhone.textContent = 'بيانات غير متاحة';
            userAddress.textContent = 'بيانات غير متاحة';
            joinDate.textContent = 'بيانات غير متاحة';
            referralCode.textContent = 'بيانات غير متاحة';
        }
    });
}

// تحميل بيانات الإحالات
function loadReferralData(userId) {
    getUserReferrals(userId, (referrals) => {
        if (referrals) {
            referralCount.textContent = Object.keys(referrals).length;
        } else {
            referralCount.textContent = '0';
        }
    });
}

// نسخ رابط الإحالة
window.copyReferralLink = function() {
    referralLink.select();
    document.execCommand('copy');
    alert('تم نسخ رابط الإحالة إلى الحافظة');
};

// مشاركة عبر واتساب
window.shareViaWhatsApp = function() {
    const text = `انضم إلى منصة تسريع باستخدام رابط الإحالة الخاص بي: ${referralLink.value}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

// مشاركة عبر فيسبوك
window.shareViaFacebook = function() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink.value)}`;
    window.open(url, '_blank');
};

// مشاركة عبر تلغرام
window.shareViaTelegram = function() {
    const text = `انضم إلى منصة تسريع باستخدام رابط الإحالة الخاص بي: ${referralLink.value}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink.value)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

// تسجيل الخروج
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        // توجيه إلى الصفحة الرئيسية بعد تسجيل الخروج
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
        alert('حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.');
    });
});
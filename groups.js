// groups.js
import { 
    auth, database,
    ref, onValue, query, orderByChild, equalTo,
    onAuthStateChanged
} from './firebase.js';
import { searchReferrals } from './referral-system.js';

// عناصر DOM
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const levelFilter = document.getElementById('level-filter');
const totalMembers = document.getElementById('total-members');
const directMembers = document.getElementById('direct-members');
const level1Members = document.getElementById('level1-members');
const membersTable = document.getElementById('members-table');
const exportBtn = document.getElementById('export-btn');
const pagination = document.getElementById('pagination');

// متغيرات التطبيق
let currentUserId = null;
let allMembers = [];
let filteredMembers = [];
let currentPage = 1;
const membersPerPage = 10;

// تحميل البيانات عند بدء التحميل
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
        
        currentUserId = user.uid;
        loadNetworkData(user.uid);
    });
}

// تحميل بيانات الشبكة
function loadNetworkData(userId) {
    // جلب جميع الإحالات
    searchReferrals(userId, '', 'all').then(members => {
        allMembers = members;
        filteredMembers = [...allMembers];
        
        // تحديث الإحصائيات
        updateStats();
        
        // عرض الأعضاء
        displayMembers();
        
        // إعداد Pagination
        setupPagination();
    });
}

// تحديث الإحصائيات
function updateStats() {
    totalMembers.textContent = allMembers.length;
    directMembers.textContent = allMembers.filter(m => m.level === 1).length;
    level1Members.textContent = allMembers.filter(m => m.level === 2).length;
}

// عرض الأعضاء
function displayMembers() {
    const tbody = membersTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-text">لا توجد نتائج</td>
            </tr>
        `;
        return;
    }
    
    // حساب بداية ونهاية الصفحة الحالية
    const startIndex = (currentPage - 1) * membersPerPage;
    const endIndex = Math.min(startIndex + membersPerPage, filteredMembers.length);
    const currentMembers = filteredMembers.slice(startIndex, endIndex);
    
    // عرض الأعضاء الحاليين
    currentMembers.forEach(member => {
        loadMemberDetails(member, tbody);
    });
}

// تحميل تفاصيل العضو
function loadMemberDetails(member, tbody) {
    const userRef = ref(database, 'users/' + member.referredUserId);
    onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userData.name || 'غير متوفر'}</td>
                <td>${userData.email || 'غير متوفر'}</td>
                <td>${userData.phone || 'غير متوفر'}</td>
                <td>${new Date(member.timestamp).toLocaleDateString('ar-SA')}</td>
                <td>${getLevelText(member.level)}</td>
                <td>${getStatusBadge(member.status)}</td>
            `;
            
            tbody.appendChild(row);
        } else {
            // إذا لم توجد بيانات المستخدم
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>غير متوفر</td>
                <td>غير متوفر</td>
                <td>غير متوفر</td>
                <td>${new Date(member.timestamp).toLocaleDateString('ar-SA')}</td>
                <td>${getLevelText(member.level)}</td>
                <td>${getStatusBadge(member.status)}</td>
            `;
            
            tbody.appendChild(row);
        }
    }, { onlyOnce: true });
}

// الحصول على نص المستوى
function getLevelText(level) {
    switch(level) {
        case 1: return 'مباشر';
        case 2: return 'المستوى الأول';
        case 3: return 'المستوى الثاني';
        case 4: return 'المستوى الثالث';
        default: return `المستوى ${level}`;
    }
}

// الحصول على badge الحالة
function getStatusBadge(status) {
    switch(status) {
        case 'completed': return '<span class="status-badge completed">مكتمل</span>';
        case 'pending': return '<span class="status-badge pending">قيد الانتظار</span>';
        case 'indirect': return '<span class="status-badge indirect">غير مباشر</span>';
        default: return '<span class="status-badge">غير معروف</span>';
    }
}

// إعداد Pagination
function setupPagination() {
    const pageCount = Math.ceil(filteredMembers.length / membersPerPage);
    pagination.innerHTML = '';
    
    if (pageCount <= 1) return;
    
    for (let i = 1; i <= pageCount; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.classList.toggle('active', i === currentPage);
        button.addEventListener('click', () => {
            currentPage = i;
            displayMembers();
            updatePaginationButtons();
        });
        pagination.appendChild(button);
    }
}

// تحديث أزرار Pagination
function updatePaginationButtons() {
    const buttons = pagination.querySelectorAll('button');
    buttons.forEach((button, index) => {
        button.classList.toggle('active', index + 1 === currentPage);
    });
}

// البحث والتصفية
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});
levelFilter.addEventListener('change', performSearch);

function performSearch() {
    const searchTerm = searchInput.value.trim();
    const level = levelFilter.value;
    
    searchReferrals(currentUserId, searchTerm, level).then(results => {
        filteredMembers = results;
        currentPage = 1;
        displayMembers();
        setupPagination();
    });
}

// تصدير البيانات
exportBtn.addEventListener('click', exportData);

function exportData() {
    // إنشاء محتوى CSV
    let csvContent = "الاسم,البريد الإلكتروني,رقم الهاتف,تاريخ الانضمام,المستوى,الحالة\n";
    
    // نستخدم Promise.all لنتأكد من جلب كل البيانات قبل التصدير
    const promises = filteredMembers.map(member => {
        return new Promise((resolve) => {
            const userRef = ref(database, 'users/' + member.referredUserId);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    const row = [
                        userData.name || 'غير متوفر',
                        userData.email || 'غير متوفر',
                        userData.phone || 'غير متوفر',
                        new Date(member.timestamp).toLocaleDateString('ar-SA'),
                        getLevelText(member.level),
                        member.status
                    ].map(field => `"${field}"`).join(',');
                    
                    resolve(row);
                } else {
                    const row = [
                        'غير متوفر',
                        'غير متوفر',
                        'غير متوفر',
                        new Date(member.timestamp).toLocaleDateString('ar-SA'),
                        getLevelText(member.level),
                        member.status
                    ].map(field => `"${field}"`).join(',');
                    
                    resolve(row);
                }
            }, { onlyOnce: true });
        });
    });
    
    Promise.all(promises).then(rows => {
        csvContent += rows.join('\n');
        
        // إنشاء ملف وتنزيله
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `مجموعة_تسريع_${new Date().toLocaleDateString('ar-SA')}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
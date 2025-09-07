// groups.js (محدث)
import { 
    auth, database,
    ref, onValue, query, orderByChild, equalTo, get,
    onAuthStateChanged
} from './firebase.js';
import { searchReferrals, loadFullNetwork, getUserData } from './referral-system.js';

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
const networkContainer = document.getElementById('network-container');

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
        loadNetworkVisualization(user.uid);
    });
}

// تحميل بيانات الشبكة
async function loadNetworkData(userId) {
    try {
        // جلب جميع الإحالات
        allMembers = await searchReferrals(userId, '', 'all');
        filteredMembers = [...allMembers];
        
        // تحديث الإحصائيات
        updateStats();
        
        // عرض الأعضاء
        displayMembers();
        
        // إعداد Pagination
        setupPagination();
    } catch (error) {
        console.error("Error loading network data:", error);
    }
}

// تحديث الإحصائيات
function updateStats() {
    totalMembers.textContent = allMembers.length;
    directMembers.textContent = allMembers.filter(m => m.level === 1).length;
    level1Members.textContent = allMembers.filter(m => m.level === 2).length;
}

// عرض الأعضاء
async function displayMembers() {
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
    for (const member of currentMembers) {
        await loadMemberDetails(member, tbody);
    }
}

// تحميل تفاصيل العضو
async function loadMemberDetails(member, tbody) {
    try {
        const userData = await getUserData(member.referredUserId);
        
        const row = document.createElement('tr');
        
        if (userData) {
            row.innerHTML = `
                <td>${userData.name || 'غير متوفر'}</td>
                <td>${userData.email || 'غير متوفر'}</td>
                <td>${userData.phone || 'غير متوفر'}</td>
                <td>${new Date(member.timestamp).toLocaleDateString('ar-SA')}</td>
                <td>${getLevelText(member.level)}</td>
                <td>${getStatusBadge(member.status)}</td>
            `;
        } else {
            // إذا لم توجد بيانات المستخدم
            row.innerHTML = `
                <td>غير متوفر</td>
                <td>غير متوفر</td>
                <td>غير متوفر</td>
                <td>${new Date(member.timestamp).toLocaleDateString('ar-SA')}</td>
                <td>${getLevelText(member.level)}</td>
                <td>${getStatusBadge(member.status)}</td>
            `;
        }
        
        tbody.appendChild(row);
    } catch (error) {
        console.error("Error loading member details:", error);
    }
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

async function performSearch() {
    const searchTerm = searchInput.value.trim();
    const level = levelFilter.value;
    
    filteredMembers = await searchReferrals(currentUserId, searchTerm, level);
    currentPage = 1;
    displayMembers();
    setupPagination();
}

// تصدير البيانات
exportBtn.addEventListener('click', exportData);

async function exportData() {
    try {
        // إنشاء محتوى CSV
        let csvContent = "الاسم,البريد الإلكتروني,رقم الهاتف,تاريخ الانضمام,المستوى,الحالة\n";
        
        // جلب بيانات كل مستخدم مُحال
        for (const member of filteredMembers) {
            const userData = await getUserData(member.referredUserId);
            
            const row = [
                userData?.name || 'غير متوفر',
                userData?.email || 'غير متوفر',
                userData?.phone || 'غير متوفر',
                new Date(member.timestamp).toLocaleDateString('ar-SA'),
                getLevelText(member.level),
                member.status
            ].map(field => `"${field}"`).join(',');
            
            csvContent += row + '\n';
        }
        
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
    } catch (error) {
        console.error("Error exporting data:", error);
    }
}

// تحميل وعرض الشبكة
async function loadNetworkVisualization(userId) {
    if (!networkContainer) return;
    
    networkContainer.innerHTML = '<div class="loading">جاري تحميل الشبكة...</div>';
    
    try {
        const network = await loadFullNetwork(userId, 3); // تحميل حتى 3 مستويات
        
        if (!network || Object.keys(network).length === 0) {
            networkContainer.innerHTML = '<div class="empty-state">لا توجد إحالات حتى الآن</div>';
            return;
        }
        
        renderNetwork(userId, network, networkContainer);
    } catch (error) {
        console.error("Error loading network visualization:", error);
        networkContainer.innerHTML = '<div class="error">فشل في تحميل الشبكة</div>';
    }
}

// عرض الشبكة
function renderNetwork(userId, network, container) {
    container.innerHTML = '';
    
    // البدء من المستخدم الحالي
    renderNetworkNode(userId, network, container, 0);
}

// عرض عقدة الشبكة
function renderNetworkNode(userId, network, container, level) {
    if (!network[userId]) return;
    
    const nodeData = network[userId].data;
    const referrals = network[userId].referrals;
    
    const nodeElement = document.createElement('div');
    nodeElement.className = `network-node level-${level}`;
    
    nodeElement.innerHTML = `
        <div class="node-header">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(nodeData.name)}&background=random" alt="صورة المستخدم">
            <div class="node-info">
                <h4>${nodeData.name}</h4>
                <p>${nodeData.email}</p>
                <span class="user-level">المستوى: ${level}</span>
            </div>
            <div class="node-stats">
                <span class="points">${nodeData.referralCount || 0} إحالة</span>
            </div>
        </div>
    `;
    
    // إذا كان هناك إحالات، إضافة زر للتوسيع
    if (referrals && Object.keys(referrals).length > 0) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = `<i class="fas fa-chevron-down"></i> ${Object.keys(referrals).length} إحالة`;
        expandBtn.onclick = () => toggleNodeExpansion(nodeElement, referrals, level + 1);
        nodeElement.appendChild(expandBtn);
    }
    
    container.appendChild(nodeElement);
}

// تبديل توسيع العقدة
function toggleNodeExpansion(node, referrals, level) {
    const childrenContainer = node.querySelector('.node-children');
    
    if (childrenContainer) {
        // إذا كان هناك حاوية أطفال بالفعل، قم بالتبديل
        childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
    } else {
        // إذا لم تكن هناك حاوية أطفال، قم بإنشائها وعرضها
        const newChildrenContainer = document.createElement('div');
        newChildrenContainer.className = 'node-children';
        
        for (const referredUserId in referrals) {
            renderNetworkNode(referredUserId, referrals, newChildrenContainer, level);
        }
        
        node.appendChild(newChildrenContainer);
    }
    }

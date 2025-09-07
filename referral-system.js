// referral-system.js
import { 
    database, ref, set, push, onValue, update, query, orderByChild, equalTo, get
} from './firebase.js';

// إنشاء رمز إحالة فريد للمستخدم
export function generateReferralCode(userId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + userId.substring(0, 2).toUpperCase();
}

// حفظ معلومات الإحالة عند إنشاء حساب جديد
export async function saveReferralData(userId, userData, referredBy = null) {
    try {
        const referralCode = generateReferralCode(userId);
        
        // تحديث بيانات المستخدم برمز الإحالة
        const updatedUserData = {
            ...userData,
            referralCode: referralCode,
            referralCount: 0,
            joinDate: new Date().toISOString(),
            referredBy: referredBy || null
        };
        
        // حفظ بيانات المستخدم الجديد
        await set(ref(database, 'users/' + userId), updatedUserData);
        
        // حفظ رمز الإحالة للبحث السريع
        await set(ref(database, 'referralCodes/' + referralCode), userId);
        
        // إذا كان هناك مستخدم أحاله، إضافة هذه المعلومة
        if (referredBy) {
            // تحديث سجل الإحالات للمستخدم الذي أحال
            const referralData = {
                referredUserId: userId,
                name: userData.name,
                email: userData.email,
                timestamp: new Date().toISOString(),
                status: 'completed',
                level: 1 // المستوى المباشر
            };
            
            await set(ref(database, `userReferrals/${referredBy}/${userId}`), referralData);
            
            // زيادة عداد الإحالات للمستخدم الذي أحال
            await updateReferralCount(referredBy);
            
            // تحديث مستويات الشبكة للمستخدم الذي أحال
            await updateNetworkLevels(referredBy, userId, 1);
        }
        
        return referralCode;
    } catch (error) {
        console.error("Error saving referral data:", error);
        throw error;
    }
}

// زيادة عداد الإحالات
export async function updateReferralCount(userId) {
    try {
        const userRef = ref(database, 'users/' + userId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const currentCount = userData.referralCount || 0;
            
            await update(userRef, {
                referralCount: currentCount + 1
            });
        }
    } catch (error) {
        console.error("Error updating referral count:", error);
    }
}

// تحديث مستويات الشبكة
async function updateNetworkLevels(sponsorId, newUserId, level) {
    try {
        // إذا كان المستخدم الذي أحال له مُحال من قبل آخر، نحدّث مستويات الشبكة
        const sponsorRef = ref(database, 'users/' + sponsorId);
        const snapshot = await get(sponsorRef);
        
        if (snapshot.exists()) {
            const sponsorData = snapshot.val();
            
            if (sponsorData.referredBy) {
                // تحديث المستوى التالي في الشبكة
                const nextLevel = level + 1;
                const networkData = {
                    referredUserId: newUserId,
                    timestamp: new Date().toISOString(),
                    status: 'indirect',
                    level: nextLevel
                };
                
                await set(ref(database, `userReferrals/${sponsorData.referredBy}/${newUserId}`), networkData);
                
                // الاستمرار في تحديث المستويات الأعلى
                await updateNetworkLevels(sponsorData.referredBy, newUserId, nextLevel);
            }
        }
    } catch (error) {
        console.error("Error updating network levels:", error);
    }
}

// جلب بيانات الإحالات للمستخدم
export function getUserReferrals(userId, callback) {
    const referralsRef = ref(database, `userReferrals/${userId}`);
    onValue(referralsRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    });
}

// الحصول على معرف المستخدم من خلال رمز الإحالة
export async function getUserIdByReferralCode(referralCode) {
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

// البحث في الإحالات
export function searchReferrals(userId, searchTerm, levelFilter = 'all') {
    return new Promise((resolve) => {
        getUserReferrals(userId, (referrals) => {
            if (!referrals) {
                resolve([]);
                return;
            }
            
            let results = Object.entries(referrals).map(([key, value]) => ({
                id: key,
                ...value
            }));
            
            // تطبيق فلتر المستوى
            if (levelFilter !== 'all') {
                results = results.filter(ref => ref.level == levelFilter);
            }
            
            // تطبيق البحث
            if (searchTerm) {
                results = results.filter(ref => {
                    return ref.id.includes(searchTerm) || 
                           ref.referredUserId.includes(searchTerm) ||
                           (ref.name && ref.name.includes(searchTerm)) ||
                           (ref.email && ref.email.includes(searchTerm));
                });
            }
            
            resolve(results);
        });
    });
}

// جلب بيانات المستخدم
export async function getUserData(userId) {
    try {
        const userRef = ref(database, 'users/' + userId);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
}

// تحميل الشبكة الكاملة
export async function loadFullNetwork(userId, maxLevel = 5) {
    const network = {};
    await loadNetworkRecursive(userId, network, 0, maxLevel);
    return network;
}

// تحميل الشبكة بشكل متكرر
async function loadNetworkRecursive(userId, network, currentLevel, maxLevel) {
    if (currentLevel > maxLevel) return;
    
    try {
        const referralsRef = ref(database, `userReferrals/${userId}`);
        const snapshot = await get(referralsRef);
        
        if (!snapshot.exists()) return;
        
        const referrals = snapshot.val();
        network[userId] = {
            level: currentLevel,
            referrals: {}
        };
        
        // تحميل بيانات المستخدم
        const userData = await getUserData(userId);
        network[userId].data = userData;
        
        // تحميل الإحالات بشكل متكرر
        for (const referredUserId in referrals) {
            network[userId].referrals[referredUserId] = {
                data: referrals[referredUserId],
                level: currentLevel + 1
            };
            
            await loadNetworkRecursive(
                referredUserId, 
                network[userId].referrals, 
                currentLevel + 1, 
                maxLevel
            );
        }
    } catch (error) {
        console.error("Error loading network recursively:", error);
    }
                      }

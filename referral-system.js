// referral-system.js
import { 
    database, ref, set, push, onValue, update, query, orderByChild, equalTo 
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
            joinDate: new Date().toISOString()
        };
        
        // إذا كان هناك مستخدم أحاله، إضافة هذه المعلومة
        if (referredBy) {
            updatedUserData.referredBy = referredBy;
            
            // تحديث سجل الإحالات للمستخدم الذي أحال
            const referralData = {
                referredUserId: userId,
                timestamp: new Date().toISOString(),
                status: 'completed',
                level: 1 // المستوى المباشر
            };
            
            await set(ref(database, `referrals/${referredBy}/${userId}`), referralData);
            
            // زيادة عداد الإحالات للمستخدم الذي أحال
            await updateReferralCount(referredBy);
            
            // تحديث مستويات الشبكة للمستخدم الذي أحال
            await updateNetworkLevels(referredBy, userId, 1);
        }
        
        // حفظ بيانات المستخدم الجديد
        await set(ref(database, 'users/' + userId), updatedUserData);
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
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const currentCount = userData.referralCount || 0;
                
                update(userRef, {
                    referralCount: currentCount + 1
                });
            }
        }, { onlyOnce: true });
    } catch (error) {
        console.error("Error updating referral count:", error);
    }
}

// تحديث مستويات الشبكة
async function updateNetworkLevels(sponsorId, newUserId, level) {
    try {
        // إذا كان المستخدم الذي أحال له مُحال من قبل آخر، نحدّث مستويات الشبكة
        const sponsorRef = ref(database, 'users/' + sponsorId);
        onValue(sponsorRef, (snapshot) => {
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
                    
                    set(ref(database, `referrals/${sponsorData.referredBy}/${newUserId}`), networkData);
                    
                    // الاستمرار في تحديث المستويات الأعلى
                    updateNetworkLevels(sponsorData.referredBy, newUserId, nextLevel);
                }
            }
        }, { onlyOnce: true });
    } catch (error) {
        console.error("Error updating network levels:", error);
    }
}

// جلب بيانات الإحالات للمستخدم
export function getUserReferrals(userId, callback) {
    const referralsRef = ref(database, `referrals/${userId}`);
    onValue(referralsRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    });
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
                    // سنحتاج لجلب بيانات المستخدم للبحث بالاسم
                    // سيتم implement هذا الجزء في groups.js
                    return ref.id.includes(searchTerm) || 
                           ref.referredUserId.includes(searchTerm);
                });
            }
            
            resolve(results);
        });
    });
}
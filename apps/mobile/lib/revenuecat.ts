import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// Keys from RevenueCat Dashboard
const API_KEYS = {
    apple: 'appl_...',
    google: 'goog_...',
};

export class IAPService {
    static async init(userId: string) {
        if (Platform.OS === 'ios') {
            await Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
        } else if (Platform.OS === 'android') {
            await Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
        }
    }

    static async getOfferings() {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                return offerings.current.availablePackages;
            }
        } catch (e) {
            console.error('Error fetching offerings', e);
        }
        return [];
    }

    static async purchasePackage(pack: PurchasesPackage) {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pack);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Error purchasing', e);
                throw e;
            }
        }
    }

    static async checkSubscriptionStatus() {
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            // Check if user has active entitlement 'pro'
            return customerInfo.entitlements.active['pro'] !== undefined;
        } catch (e) {
            return false;
        }
    }
}

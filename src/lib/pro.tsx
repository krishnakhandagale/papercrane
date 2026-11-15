import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { ENTITLEMENT_ID, revenueCatKey } from './config';

type ProState = {
  /** True once we know whether the user is Pro (or purchases are unavailable). */
  ready: boolean;
  isPro: boolean;
  /** False when no RevenueCat key is configured or setup failed. */
  available: boolean;
  offering: PurchasesOffering | null;
  managementURL: string | null;
  /** Returns true if the purchase completed, false if the user cancelled. Throws on errors. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Returns true if an active Pro entitlement was found. */
  restore: () => Promise<boolean>;
  refreshOfferings: () => Promise<void>;
  /** Development only: pretend to be Pro without RevenueCat. */
  devSetPro: (value: boolean) => void;
};

const ProContext = createContext<ProState | null>(null);

const hasPro = (info: CustomerInfo) => ENTITLEMENT_ID in info.entitlements.active;

let configured = false;

export function ProProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [devPro, setDevPro] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);

  const applyInfo = useCallback((info: CustomerInfo) => {
    setIsPro(hasPro(info));
    setManagementURL(info.managementURL);
  }, []);

  const refreshOfferings = useCallback(async () => {
    if (!configured) return;
    try {
      const offerings = await Purchases.getOfferings();
      setOffering(offerings.current);
    } catch (e) {
      console.warn('[pro] getOfferings failed', e);
    }
  }, []);

  useEffect(() => {
    const apiKey = revenueCatKey();
    if (!apiKey) {
      console.warn('[pro] No RevenueCat API key set. Purchases are disabled (see .env.example).');
      setReady(true);
      return;
    }
    let listener: ((info: CustomerInfo) => void) | null = null;
    (async () => {
      try {
        if (!configured) {
          if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
          Purchases.configure({ apiKey });
          configured = true;
        }
        setAvailable(true);
        listener = applyInfo;
        Purchases.addCustomerInfoUpdateListener(listener);
        applyInfo(await Purchases.getCustomerInfo());
        await refreshOfferings();
      } catch (e) {
        console.warn('[pro] RevenueCat setup failed', e);
      } finally {
        setReady(true);
      }
    })();
    return () => {
      if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyInfo, refreshOfferings]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyInfo(customerInfo);
        return hasPro(customerInfo);
      } catch (e: any) {
        if (e?.userCancelled) return false;
        throw e;
      }
    },
    [applyInfo]
  );

  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    applyInfo(info);
    return hasPro(info);
  }, [applyInfo]);

  const value = useMemo<ProState>(
    () => ({
      ready,
      isPro: isPro || (__DEV__ && devPro),
      available,
      offering,
      managementURL,
      purchase,
      restore,
      refreshOfferings,
      devSetPro: (v) => __DEV__ && setDevPro(v),
    }),
    [ready, isPro, devPro, available, offering, managementURL, purchase, restore, refreshOfferings]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro() {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside <ProProvider>');
  return ctx;
}

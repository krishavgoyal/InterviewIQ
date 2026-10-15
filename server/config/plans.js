export const plans = {
  basic: { id: "basic", amount: 100, credits: 150, name: "Starter Pack" },
  pro: { id: "pro", amount: 500, credits: 650, name: "Pro Pack" },
};

export const getPlan = (planId) => plans[planId] || null;

export function calculateDebtScenario(input: {
  balance: number;
  interestRate: number;
  plannedPayment: number;
}) {
  const monthlyRate = input.interestRate / 100 / 12;
  let balance = input.balance;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0 && months < 600) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance = balance + interest - input.plannedPayment;
    months += 1;

    if (input.plannedPayment <= interest) {
      return {
        payoffMonths: 600,
        totalInterest: Number(totalInterest.toFixed(2))
      };
    }
  }

  return {
    payoffMonths: months,
    totalInterest: Number(totalInterest.toFixed(2))
  };
}

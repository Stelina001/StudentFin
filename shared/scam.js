// Rule-based scam signal detector for messages, offers and listings students commonly receive.
// Deterministic and explainable: every point of risk is tied to a visible signal.
const SIGNALS = [
  { id: 'upfront', weight: 3, label: 'Asks for money up front',
    re: /\b(deposit|advance|upfront|up-front|processing fee|registration fee|application fee|activation fee|pay (?:first|before)|send (?:the )?money first|reservation fee)\b/i,
    why: 'Legitimate landlords, employers and scholarships rarely require payment before you have seen or signed anything.' },
  { id: 'untraceable', weight: 3, label: 'Untraceable payment method',
    re: /\b(gift ?cards?|itunes|steam card|crypto|bitcoin|usdt|western union|moneygram|wire (?:it|the money)|cash app|friends and family)\b/i,
    why: 'Gift cards, crypto and cash transfers are hard to reverse, which is why scammers prefer them.' },
  { id: 'credentials', weight: 4, label: 'Requests codes, PIN or passwords',
    re: /\b(otp|one[- ]time (?:code|password)|verification code|pin\b|cvv|cvc|password|login details|card number|sms code)\b/i,
    why: 'No real bank, university or company will ask you to share a code, PIN or password.' },
  { id: 'urgency', weight: 2, label: 'Pressure and urgency',
    re: /\b(urgent|immediately|within (?:\d+ )?(?:hours?|minutes?)|today only|last chance|act now|right now|account (?:will be )?(?:blocked|suspended|closed)|final notice)\b/i,
    why: 'Artificial deadlines are used to stop you from checking the facts.' },
  { id: 'toogood', weight: 2, label: 'Too good to be true',
    re: /\b(guaranteed (?:return|profit|income)|risk[- ]free|double your|earn \S+ (?:per|a) (?:day|week) from home|no experience needed|easy money|100% (?:profit|return)|you (?:have )?won|lottery|prize)\b/i,
    why: 'Guaranteed returns, prizes you did not enter and high pay for little work are classic lures.' },
  { id: 'offplatform', weight: 1, label: 'Moves you off the platform',
    re: /\b(whatsapp|telegram|signal|text me on|contact me (?:at|on)|outside (?:the )?(?:app|platform)|my personal email)\b/i,
    why: 'Moving the conversation away removes the platform’s buyer and renter protection.' },
  { id: 'abroad', weight: 2, label: 'Owner is “abroad” and cannot meet',
    re: /\b(i am (?:currently )?(?:abroad|out of the country|overseas)|cannot show (?:you )?the (?:flat|apartment|room)|keys? (?:will be )?(?:sent|mailed|delivered)|no viewing)\b/i,
    why: 'A common rental scam: the “landlord” cannot meet, but wants a deposit to post the keys.' },
  { id: 'impersonation', weight: 2, label: 'Claims to be an official body',
    re: /\b(embassy|immigration office|tax office|police|your bank|university finance office|scholarship committee|ministry)\b/i,
    why: 'Scammers impersonate authorities. Contact the organisation through its official website, not the message.' },
  { id: 'link', weight: 1, label: 'Contains a link',
    re: /(https?:\/\/|www\.|bit\.ly|tinyurl|t\.me\/)/i,
    why: 'Check where links really go before clicking; never log in through a link sent to you.' },
  { id: 'overpay', weight: 3, label: 'Overpayment / refund the difference',
    re: /\b(send (?:back|you) the (?:difference|rest|extra)|overpaid|refund the (?:difference|extra)|cheque for more)\b/i,
    why: 'Overpayment scams send a fake payment and ask you to return the “extra” with real money.' }
];

export function scamCheck(text) {
  const t = String(text || '').slice(0, 5000);
  if (!t.trim()) return { error: 'Paste a message, offer or listing to check.' };
  const matched = SIGNALS.filter(s => s.re.test(t)).map(s => ({
    id: s.id, label: s.label, weight: s.weight, why: s.why, excerpt: (t.match(s.re) || [''])[0]
  }));
  const score = Math.min(10, matched.reduce((s, m) => s + m.weight, 0));
  const level = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  const advice = level === 'high'
    ? 'Do not send money or codes. Verify the sender through an official channel and report the message to the platform.'
    : level === 'medium'
      ? 'Be careful. Verify the person or organisation independently before paying anything.'
      : 'No strong scam signals found, but stay alert: this check cannot guarantee a message is safe.';
  return { score, level, signals: matched, advice };
}

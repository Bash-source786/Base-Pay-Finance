(function () {
 'use strict';

 // Examples use fixed inputs. They never execute the simulator's save or transaction handlers.
 const topics = {
  home: [
   ['Your balances', '.money-overview', 'Available cash is what you can spend. Net worth adds what you own and subtracts what you owe.', {demo:['Cash £100 · Savings £30 · Debt £20', ['Work out net worth', '£100 + £30 − £20 = £110']]}],
   ['What to do next', '.home-start', 'Resume an unfinished lesson or jump straight to learning, trading or a calculator.'],
   ['Suggested next step', '.guide-card, details:has(.guide-card)', 'Open the suggestion for an activity matched to your progress.'],
   ['Financial health', {summary:'What do these scores mean?'}, 'Open this to see how savings, investments and debt shape your score.'],
   ['Net worth history', {summary:'Net worth history'}, 'Open the chart to see how your net worth changed over the simulation.'],
   ['Money snapshot', {summary:'Full money snapshot'}, 'Expand this to see where your money is held and what you owe.'],
   ['Simulation time', '[onclick="advanceDay(1)"]', 'Next day, payday and fast-forward move the simulation by different amounts.', {demo:['Example starts on Day 1.', ['Next day', 'Day 2 · One day of market and event updates.'], ['Skip to payday', 'Day 31 · Your pay or pocket money arrives.'], ['Fast-forward 1 year', 'Day 361 · 360 simulated days pass, including several paydays.']]}],
   ['Payslip', {heading:'Last payslip'}, 'Once you reach payday, the payslip shows gross pay, deductions and take-home pay.', {mode:'adult', demo:['Example gross pay £2,800 · Deductions £600', ['Show take-home pay', '£2,800 − £600 = £2,200']]}],
   ['Turn 18', {heading:'Growing up'}, 'Turning 18 opens adult products and converts your Junior ISA to an adult Stocks & Shares ISA.', {mode:'youth'}],
   ['Settings and saves', {heading:'Settings'}, 'Manage your save file or guest reset here. Adult players can also set their student loan status for future payslips.'],
   ['Appearance and account', {outside:'.account-controls'}, 'Use Aesthetics to change colours, the account button to manage sign-in and ? to reopen this tab’s tutorial.'],
  ],
  learn: [
   ['Find a lesson', '.lesson-toolbar', 'Search by topic, hide completed lessons or check how far you’ve progressed.', {sub:'lessons'}],
   ['Make a lesson decision', ['[data-lesson]', '#lesson-list'], 'Open a lesson to make a choice, get feedback and answer a challenge.', {sub:'lessons', demo:['You have £100. A £30 bill is due tomorrow and headphones cost £80.', ['Set aside £30', 'Bill covered · £70 left for other spending.'], ['Buy the headphones', '£20 left · You’re £10 short for the bill.']]}],
   ['Glossary', '#learn-body input', 'Search for terms such as APR or diversification to see a short definition.', {sub:'glossary', demo:['Try a sample lookup.', ['APR', 'Annual percentage rate · The yearly cost of borrowing.'], ['Diversification', 'Spreading your investments so you rely less on any one holding.']]}],
   ['Scenarios', '.scenario-card:first-child', 'Think through the situation, then press Reveal answer to compare your reasoning.', {sub:'scenarios'}],
   ['Debt vs Invest', '#dt-amount', 'Enter an amount, debt APR, expected investment return and time period to compare the two outcomes.', {sub:'tree', demo:['£1,000 over one year · Debt APR 25% · Expected return 5%', ['Compare', '£250 interest avoided vs £50 expected investment gain.']]}],
  ],
  bank: [
   ['Choose a bank', '.bank-card', 'Compare fees, savings rates, overdraft costs and perks before selecting a bank.', {sub:'account', demo:['Example accounts · Compare the yearly fee first.', ['£0 a month', '£0 a year in account fees.'], ['£5 a month', '£60 a year in account fees.']]}],
   ['Overdraft', '.bank-card', 'The overdraft is a borrowing limit on your current account. Its APR is the yearly borrowing rate.', {sub:'account'}],
   ['Easy-access savings', '#sav-amt', 'Deposit moves cash into savings. Withdraw moves it back to your available cash.', {sub:'savings', demo:['Starting example · Cash £100 · Savings £50', ['Deposit £30', 'Cash £70 · Savings £80'], ['Withdraw £30', 'Cash £130 · Savings £20']]}],
   ['Fixed-term savings', {heading:'Fixed-term / notice savings'}, 'Choose an amount and a term. The money stays locked until the maturity day.', {sub:'savings', demo:['Try the two lock periods.', ['6 months', 'Money locked for 6 months · +0.6% rate boost.'], ['12 months', 'Money locked for 12 months · +1.1% rate boost.']]}],
   ['Premium Bonds', '#pb-amt', 'Deposit or withdraw here. The simulator enters your balance into prize draws instead of paying interest.', {sub:'savings'}],
   ['ISA allowance', {heading:'ISA allowance this tax year'}, 'The bar counts what you’ve paid in this tax year. The value of your holdings can change separately.', {sub:'isas', mode:'adult'}],
   ['Junior ISA', '#jisa-amt', 'Deposit to fund your Junior ISA. That balance can be used to buy investments in Invest.', {sub:'isas', mode:'youth', demo:['Example · ISA cash £0', ['Deposit £50', 'ISA cash £50 available to invest.']]}],
   ['Cash ISA', '#cisa-amt', 'Deposit here to save cash and earn simulated tax-free interest.', {sub:'isas', mode:'adult'}],
   ['Stocks & Shares ISA', '#sisa-amt', 'Deposit cash here first. In Invest, choose Stocks & Shares ISA to buy with that cash.', {sub:'isas', mode:'adult', demo:['Example · ISA cash £0', ['Fund the ISA with £50', 'ISA cash £50 available to invest.']]}],
   ['Lifetime ISA', {heading:'Lifetime ISA (LISA)'}, 'After the lesson unlocks it, contribute for a bonus and choose the withdrawal reason here.', {sub:'isas', mode:'adult', demo:['Example · £100 contribution plus £25 bonus', ['Eligible withdrawal', 'Receive £125.'], ['Other withdrawal', 'A 25% charge leaves £93.75.']]}],
   ['Innovative Finance ISA', '#ifisa-amt', 'Fund a loan part, track defaults and withdraw any accrued interest from this section.', {sub:'isas', mode:'adult'}],
   ['Pension contributions', {heading:'Workplace pension'}, 'Set your contribution with the slider. Your employer and tax relief can add to the pot.', {sub:'pension', mode:'adult'}],
   ['Pension top-up', '#pension-topup', 'Move available cash into your pension and compare the updated projection.', {sub:'pension', mode:'adult', demo:['Example with relief at source', ['Top up £80', '£80 contribution + £20 tax relief = £100 added.']]}],
   ['Pension at 18', {heading:'Workplace pension'}, 'Workplace pension controls become available when you turn 18 in the simulation.', {sub:'pension', mode:'youth'}],
  ],
  invest: [
   ['Price ticker', '#invest-ticker', 'The ticker shows current simulated prices and the latest price change.'],
   ['Simulation days', '[onclick="advanceDay(1)"]', 'These buttons move whole simulation days and update long-term prices, paydays and events.'],
   ['Asset classes', {summary:'Compare asset classes'}, 'Open the comparison for a quick look at the risk and typical behaviour of each asset class.'],
   ['Buy and sell holdings', '#buy-idx', 'Enter a pound amount, choose the funded account, then use Buy or Sell £. Sell all closes the whole holding.', {demo:['Example · £50 in investment-account cash · £20 holding', ['Buy £20', 'Cash £30 · Holding £40 at the same price.'], ['Sell £20', 'Cash £70 · Holding £0 at the same price.']]}],
   ['Price charts', '#spark-idx', 'The chart shows recent price history. A holding can lose value even if you keep the same number of units.', {demo:['Example · Your fund holding starts at £20.', ['Advance one day', '£20 → £18 · A 10% fall leaves the same number of units.']]}],
   ['Locked investments', '.lock-row, #buy-idx', 'Complete Diversification Basics to lift the starting trade cap. Investment Vehicles 101 unlocks bonds, REITs and crypto.'],
   ['Guided gold trade', '#dt-gold-replay', 'Open the guided replay to make a prediction and see how a rate announcement changes the gold quote.'],
   ['Trading wallet', '#practice-trading-desk > .card-row:nth-of-type(2), #practice-trading-desk', 'The trading desk uses its own cash and positions. Unrealised profit or loss becomes realised when you close.'],
   ['Intraday clock', '.trade-time', 'Advance minutes or hours to update trading quotes. End session to cancel pending orders and stop the clock.'],
   ['Choose a market', '#dt-market', 'Use the watchlist or selector to switch between shares, funds, gold and fictional currency pairs.'],
   ['Bid, ask and spread', '.trade-quotes', 'Ask is the buy price. Bid is the sell price. The difference is the spread.', {demo:['Example · Ask £101 · Bid £100', ['Buy and immediately sell 1 unit', 'Pay £101 · Receive £100 · Lose £1 to the spread.']]}],
   ['Candlestick chart', '#dt-market-data', 'Each candle shows the first, highest, lowest and last midpoint of its 15-minute period.'],
   ['Market or limit buy', '#dt-order-type', 'A market buy uses the current ask. A limit buy waits for the ask to reach your maximum price.', {demo:['Example · Current ask £101 · Buy limit £99', ['Market buy', 'Fills at the current £101 ask.'], ['Limit buy', 'Stays pending while the ask is above £99.']]}],
   ['Budget and planned stop', '#dt-budget', 'The budget sets how much cash you use. The planned stop estimates risk and does not place an exit order.'],
   ['Market news', '#dt-news', 'Open simulated news to see what changed the selected market or the pound. Quotes can move and spreads can widen.'],
   ['Pending orders', ['[onclick^="cancelDayOrder"]', '#dt-ticket'], 'A pending limit buy reserves cash. Cancel the order to release that cash.'],
   ['Positions and exits', ['.trade-position', '#trade-open-positions'], 'Close sells at the bid. After a buy fills, set a stop-loss or take-profit from the position’s exit orders.', {demo:['Example · Buy at £100 · Stop-loss at £95', ['Bid reaches £94', 'Stop triggers · Sale can fill at £94, below the stop price.']]}],
   ['Trade history', ['#dt-history', '#trade-open-positions'], 'Completed buys, sales and other actions appear in Recent trade history after you trade.'],
  ],
  property: [
   ['Unlock Property', '.lock-row', 'Complete Mortgages & Leverage in Learn to unlock listings and ownership controls.', {when:()=>!state.lessonsCompleted.includes(9)}],
   ['Listings and your rate', {heading:'Listings'}, 'Compare prices in Listings. Your simulated credit tier sets the mortgage rate you’re offered.'],
   ['Deposit and mortgage term', '[id^="dep-"]', 'Set how much you’ll pay upfront and how long you’ll borrow the rest. Then choose Get mortgage & buy.', {demo:['Example property price £200,000', ['Set 10% deposit', 'Pay £20,000 upfront · Borrow £180,000.'], ['Set 20% deposit', 'Pay £40,000 upfront · Borrow £160,000.']]}],
   ['Your properties and equity', {heading:'Your properties'}, 'Check the current value, balance and monthly payment. Equity is the value minus the loan still owed.', {demo:['Example · Home value £200,000 · Mortgage £160,000', ['Calculate equity', '£40,000 equity.']]}],
   ['Overpay or sell', '[id^="op-"], [onclick^="confirmSellProperty"]', 'Overpay reduces the remaining mortgage. Selling clears the mortgage from the proceeds before paying out equity.'],
  ],
  credit: [
   ['Credit score and tier', '#tab-credit > .card', 'The gauge shows your simulated credit score and borrowing tier.'],
   ['What shapes your score', {heading:"What's shaping your score"}, 'Check missed payments, the share of your limit used, credit history, applications and the electoral roll setting.'],
   ['Unlock borrowing', '.lock-row', 'Complete How Interest Really Works and Credit Scores Explained to apply for simulated credit.', {when:()=>!creditGateOK()}],
   ['Credit card', {heading:'Credit card'}, 'Apply for a card, spend up to the limit, then pay the balance from your cash.', {demo:['Example · Balance £100 · Limit £500', ['Spend £50', 'Balance £150 · 30% of limit used.'], ['Pay £50', 'Balance £50 · 10% of limit used.']]}],
   ['Personal loan', {heading:'Personal loan'}, 'Choose an amount and term. Once approved, track monthly payments and make extra payments here.'],
   ['Buy Now Pay Later', '#bnpl-amt', 'Split a purchase into three payments and check the next due day.', {demo:['Example purchase £60', ['Split into 3', '£20 now · £20 later · £20 in the final instalment.']]}],
   ['Credit tiers', {heading:'Credit tiers reference'}, 'Compare the simulated card, loan and mortgage rates offered at different scores.'],
  ],
  tools: [
   ['Budget split', '#bud-bills', 'Split your next take-home pay between bills, fun and savings. Save the split once it totals 100%.', {sub:'budget', demo:['Example take-home pay £100', ['50% bills · 20% fun · 30% savings', '£50 bills · £20 fun · £30 savings.'], ['50% bills · 20% fun · 10% savings', '£20 still needs a job.']]}],
   ['ISA Tracker', '#tools-body .progress-bar', 'Compare what you added this tax year with the allowance. The balance rows include current values.', {sub:'isa'}],
   ['Growth Calc', '#gc-principal', 'Set your starting amount, monthly contribution, assumed growth and years. Calculate to plot the result.', {sub:'growth', demo:['Example · £1,000 starting balance · 5% growth · No additions', ['After 1 year', '£1,050'], ['After 2 years', '£1,102.50 · The second year also earns growth on the first year’s gain.']]}],
   ['Mortgage Calc', '#mc-price', 'Change the property price, deposit, rate or term to see the estimated payment and upfront costs.', {sub:'mortgage', mode:'adult'}],
   ['Card Payoff', '#pc-balance', 'Enter your card’s balance, APR and minimum payment rules to see how long repayment could take.', {sub:'payoff', mode:'adult'}],
  ],
  news: [
   ['Read a headline', '.news-item, #tab-news > .card', 'As simulation days pass, this feed shows dated announcements that can move markets.', {demo:['Example headline · A fictional company warns of lower profits.', ['See a possible effect', 'Expected profits fall → Investors may sell → Share price can fall.']]}],
  ],
  awards: [
   ['XP and Free Play', '#tab-awards > .card', 'XP tracks your learning progress. Complete every lesson to unlock Free Play.'],
   ['Achievements', '.ach-grid', 'Browse the cards to see what you’ve earned and what action unlocks each remaining achievement.'],
  ],
 };

 const subtab = {
  learn: {current:()=>learnSub, set:id=>{learnSub=id;}},
  bank: {current:()=>bankSub, set:id=>{bankSub=id;}},
  tools: {current:()=>toolsSub, set:id=>{toolsSub=id;}},
 };
 let active = null;
 let card;
 let highlighted;

 function removeGuide(){
  card?.remove();
  highlighted?.classList.remove('tab-tutorial-target');
  card = undefined;
  highlighted = undefined;
 }

 function exit(restoreFocus=true){
  if(!active) return;
  const panel = document.getElementById('tab-'+active.tab);
  active = null;
  removeGuide();
  if(restoreFocus){
   const start = panel.querySelector('.tab-tutorial-start');
   start.focus({preventScroll:true});
   start.scrollIntoView({block:'nearest'});
  }
 }

 function start(){
  if(!state || !topics[currentTab]) return;
  const steps = topics[currentTab].filter(([, , , options={}])=>
   (!options.mode || options.mode===state.mode) && (!options.when || options.when())
  );
  const currentSub = subtab[currentTab]?.current();
  const index = steps.findIndex(([, , , options])=>options?.sub===currentSub);
  active = {tab:currentTab, steps, index:Math.max(0,index)};
  showStep(active.index);
 }

 function showStep(index){
  if(!active || !active.steps[index]) return;
  active.index = index;
  const [, , , options={}] = active.steps[index];
  const section = subtab[active.tab];
  if(options.sub && section.current()!==options.sub){
   section.set(options.sub);
   renderTab(active.tab);
  } else {
   render(active.tab);
  }
  card.scrollIntoView({block:'start'});
  card.querySelector('h2').focus({preventScroll:true});
 }

 function findTarget(panel, target){
  if(Array.isArray(target)) return target.map(selector=>panel.querySelector(selector)).find(Boolean);
  if(typeof target==='string'){
   return panel.querySelector(target);
  }
  if(target.outside) return document.querySelector(target.outside);
  if(target.heading){
   const heading = [...panel.querySelectorAll('.section-title h2')].find(node=>node.textContent===target.heading);
   return heading?.parentElement.nextElementSibling || heading;
  }
  return [...panel.querySelectorAll('summary')].find(node=>node.textContent.startsWith(target.summary))?.parentElement;
 }

 function demoHTML([prompt,...choices]){
  return `<div class="tab-tutorial-demo">
   <p class="tab-tutorial-meta">Practice example · ${prompt}</p>
   ${choices.map(([label],index)=>`<button type="button" class="btn sm" data-example="${index}">${label}</button>`).join('')}
   <output aria-live="polite"></output>
  </div>`;
 }

 function render(tab){
  if(active?.tab!==tab) return;
  removeGuide();
  const currentSub = subtab[tab]?.current();
  if(currentSub && active.steps[active.index][3]?.sub!==currentSub){
   const index = active.steps.findIndex(([, , , options])=>options?.sub===currentSub);
   if(index!==-1) active.index = index;
  }
  const {steps,index} = active;
  const [label,target,description,options={}] = steps[index];
  const panel = document.getElementById('tab-'+tab);
  const heading = panel.querySelector('.page-heading');
  highlighted = findTarget(panel,target) || panel.querySelector(':scope > .lock-row');
  let anchor = highlighted;
  if(anchor && panel.contains(anchor)){
   while(!anchor.parentElement.matches('.tabpanel, #bank-body, #tools-body, #learn-body, .trade-desk')){
    anchor=anchor.parentElement;
   }
  } else {
   anchor=heading.nextElementSibling;
  }
  highlighted ||= anchor;
  highlighted?.classList.add('tab-tutorial-target');
  const disclosure = highlighted?.matches('details') ? highlighted : null;
  card = document.createElement('section');
  card.className = 'tab-tutorial';
  card.setAttribute('aria-labelledby','tab-tutorial-title');
  card.innerHTML = `
   <p class="tab-tutorial-meta">${TABS.find(item=>item.id===tab).label} tutorial · ${index+1} of ${steps.length}</p>
   <h2 id="tab-tutorial-title" tabindex="-1">${label}</h2>
   <p>${description}</p>
   ${options.demo?demoHTML(options.demo):''}
   <div class="tab-tutorial-actions">
    ${disclosure?'<button type="button" class="btn sm" data-guide-action="reveal">Show highlighted section</button>':''}
    ${index>0?'<button type="button" class="btn sm" data-guide-action="back">Back</button>':''}
    <button type="button" class="btn primary sm" data-guide-action="next">${index===steps.length-1?'Done':'Next'}</button>
    <button type="button" class="btn ghost sm" data-guide-action="exit">Exit tutorial</button>
   </div>
   <label class="tab-tutorial-topic">Jump to a topic
    <select>${steps.map(([name],i)=>`<option value="${i}"${index===i?' selected':''}>${name}</option>`).join('')}</select>
   </label>`;
  if(anchor) anchor.before(card);
  else panel.append(card);
  card.querySelector('select').addEventListener('change',event=>showStep(Number(event.target.value)));
  card.addEventListener('click', event=>{
   const action = event.target.dataset.guideAction;
   if(action==='exit' || (action==='next' && index===steps.length-1)) exit();
   else if(action==='next') showStep(index+1);
   else if(action==='back') showStep(index-1);
   else if(action==='reveal'){
    disclosure.open = true;
    disclosure.querySelector('summary').focus({preventScroll:true});
    disclosure.scrollIntoView({block:'nearest'});
   }
   else if(event.target.hasAttribute('data-example')){
    const result = options.demo[Number(event.target.dataset.example)+1][1];
    card.querySelector('output').textContent = result;
   }
  });
  card.addEventListener('keydown',event=>{
   if(event.key==='Escape'){ event.preventDefault(); exit(); }
  });
 }

 window.BasePayTutorial = {start,render,exit};
})();

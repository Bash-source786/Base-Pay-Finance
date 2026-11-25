(() => {
  const storageKey = 'basepayPersonalBudgets:v1';
  const categories = [
    'Food', 'Clothes', 'Travel', 'Hobbies', 'Gifts', 'Phone bills',
    'Insurance', 'Music subscriptions', 'Gym memberships', 'Savings'
  ];
  const starterCategories = ['Food', 'Travel', 'Savings'];
  const frequency = { monthly: 12, weekly: 52, yearly: 1 };
  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  const pounds = pence => money.format(pence / 100);
  const amount = value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1000000
      ? Math.round(number * 100) : 0;
  };
  const track = event => window.basepayTrack?.(event);

  let practiceStep = 0;
  let selectedMonth = '';
  let draft;
  let dirty = false;

  function currentMonth() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  function readBudgets() {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function loadMonth(month) {
    selectedMonth = month;
    dirty = false;
    let saved;
    try { saved = readBudgets()[month]; } catch (_) {}
    draft = {
      expected: saved?.expected ?? '',
      received: saved?.received ?? '',
      target: saved?.target ?? '',
      alreadySaved: saved?.alreadySaved ?? '',
      rows: Array.isArray(saved?.rows) ? saved.rows : starterCategories.map(name => ({ name, savingsGoal: name === 'Savings' }))
    };
  }

  function renderPractice(container) {
    const steps = [
      {
        prompt: 'You expect £420 from your first job on day 10. A £45 travel pass is due on day 3. Can you cover it with £30 in your account today?',
        choices: [
          ['Check the balance before payday', 'You would be £15 short on day 3. A positive month-end balance can hide a shortfall before payday.'],
          ['Count the upcoming pay', 'The £420 arrives on day 10, so it cannot cover the day 3 bill. You would be £15 short when it is due.']
        ]
      },
      {
        prompt: 'Your original plan leaves £105 after spending and savings. Fewer shifts cost you £70 in pay and an unexpected bill costs £40. What would you adjust?',
        choices: [
          ['Cut £20 from planned spending', 'The two changes leave you £5 short. Cutting spending by £20 leaves £15 and keeps your original savings contribution.'],
          ['Put £10 less into savings', 'The two changes leave you £5 short. Saving £10 less leaves £5, but delays your savings goal.']
        ]
      }
    ];
    const step = steps[practiceStep];
    const paydayTimeline = practiceStep === 0 ? `
      <dl class="budget-timeline">
        <div><dt>Today</dt><dd>£30 available</dd></div>
        <div><dt>Day 3</dt><dd>£45 travel pass due</dd></div>
        <div><dt>Day 10</dt><dd>£420 payday</dd></div>
      </dl>` : '';
    container.innerHTML = `
      <section class="card" aria-labelledby="practice-budget-title">
        <h2 id="practice-budget-title" tabindex="-1">Try a first-job budget</h2>
        <p class="muted">Use fictional money to practise handling payday, bills and changes to your income.</p>
        ${step ? `<p class="faint">Step ${practiceStep + 1} of ${steps.length}</p>
          ${paydayTimeline}<p>${step.prompt}</p><div class="btn-row budget-choices"></div>
          <p class="budget-feedback" role="status"></p>`
          : '<p>You finished the scenario. Check when bills are due, then leave some room in your budget for changes to pay or spending.</p><div class="btn-row"><button type="button" class="btn primary" data-real-budget>Use in real life</button><button type="button" class="btn" data-replay-budget>Try again</button></div>'}
      </section>`;
    if (!step) {
      container.querySelector('[data-real-budget]').onclick = () => setToolsSub('personal');
      container.querySelector('[data-replay-budget]').onclick = () => {
        practiceStep = 0;
        renderPractice(container);
        container.querySelector('h2').focus();
      };
      return;
    }
    const choices = container.querySelector('.budget-choices');
    for (const [label, feedback] of step.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = label;
      button.onclick = () => {
        track(practiceStep === 0 ? 'budget_practice_started' : 'budget_practice_choice_made');
        container.querySelector('.budget-feedback').textContent = feedback;
        choices.querySelectorAll('button').forEach(choice => { choice.disabled = true; });
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn primary';
        next.textContent = practiceStep + 1 === steps.length ? 'Finish scenario' : 'Next decision';
        next.onclick = () => {
          practiceStep++;
          if (practiceStep === steps.length) track('budget_practice_completed');
          renderPractice(container);
          container.querySelector('h2').focus();
        };
        container.querySelector('.budget-feedback').after(next);
        next.focus();
      };
      choices.append(button);
    }
  }

  function renderPersonal(container) {
    if (!draft) loadMonth(currentMonth());
    container.innerHTML = `
      <section class="card" aria-labelledby="personal-budget-title">
        <h2 id="personal-budget-title">Your monthly budget</h2>
        <p class="muted">Enter your own amounts or use estimates. This budget is separate from the simulation and stays in this browser, even when you sign in. Anyone using this browser can open it.</p>
        <div class="field"><label for="budget-month">Budget month</label><input id="budget-month" type="month"></div>
        <form class="personal-budget-form">
          <div class="budget-pair">
            <div class="field"><label for="budget-expected">Expected take-home income (£)</label><input id="budget-expected" type="number" min="0" max="1000000" step="0.01"></div>
            <div class="field"><label for="budget-received">Income received so far (£)</label><input id="budget-received" type="number" min="0" max="1000000" step="0.01"></div>
          </div>
          <div class="budget-totals" role="region" aria-label="Budget summary"></div>
          <h3>Spending and savings</h3>
          <p class="muted">Start with what you plan to spend. You can leave actual spending blank and fill it in as you go.</p>
          <div class="budget-rows"></div>
          <div class="budget-add-row">
            <div class="field"><label for="budget-category">Category to add</label><select id="budget-category"></select></div>
            <button type="button" class="btn budget-add">Add category</button>
          </div>
          <h3>Savings goal</h3>
          <p class="muted">Use the Savings row for the amount you plan to put towards this goal each month.</p>
          <div class="budget-pair">
            <div class="field"><label for="budget-target">Savings target (£)</label><input id="budget-target" type="number" min="0" max="1000000" step="0.01"></div>
            <div class="field"><label for="budget-saved">Already saved (£)</label><input id="budget-saved" type="number" min="0" max="1000000" step="0.01"></div>
          </div>
          <p class="budget-goal-result" role="status"></p>
          <div class="btn-row"><button type="submit" class="btn primary">Save this month</button>
            <button type="button" class="btn budget-delete">Clear this month</button></div>
          <p class="budget-save-status" role="status">${dirty ? 'Unsaved changes.' : ''}</p>
        </form>
      </section>`;
    const form = container.querySelector('form');
    const month = container.querySelector('#budget-month');
    month.value = selectedMonth;
    month.onchange = () => {
      if (!/^\d{4}-\d{2}$/.test(month.value) ||
          (dirty && !confirm('Switch months and discard unsaved changes?'))) {
        month.value = selectedMonth;
        return;
      }
      loadMonth(month.value);
      renderPersonal(container);
      container.querySelector('#budget-month').focus();
    };
    const rows = form.querySelector('.budget-rows');
    const categoryPicker = form.querySelector('#budget-category');
    const status = form.querySelector('.budget-save-status');

    function refreshCategoryPicker() {
      const selected = categoryPicker.value;
      const used = new Set(draft.rows.map(row => row.name.trim().toLowerCase()));
      const available = categories.filter(name => !used.has(name.toLowerCase()));
      categoryPicker.replaceChildren(new Option('Custom category', ''), ...available.map(name => new Option(name, name)));
      if (available.includes(selected)) categoryPicker.value = selected;
    }

    function updateSummary() {
      let planned = 0;
      let actual = 0;
      let monthlySavings = 0;
      let recurringAnnual = 0;
      for (const row of draft.rows) {
        const annual = amount(row.planned) * (frequency[row.frequency] ?? 12);
        const monthly = Math.round(annual / 12);
        planned += monthly;
        actual += amount(row.actual);
        if (row.savingsGoal || row.name.trim().toLowerCase() === 'savings') monthlySavings += monthly;
        recurringAnnual += annual;
      }
      const goal = amount(draft.target);
      const leftToSave = Math.max(0, goal - amount(draft.alreadySaved));
      const plannedLeft = amount(draft.expected) - planned;
      const actualLeft = amount(draft.received) - actual;
      form.querySelector('.budget-totals').innerHTML = `
        <div class="card-row"><span>Planned monthly spending and savings</span><strong>${pounds(planned)}</strong></div>
        <div class="card-row"><span>${draft.expected !== '' && plannedLeft < 0 ? 'Planned shortfall' : 'Left in your plan'}</span><strong>${draft.expected === '' ? 'Enter expected income' : pounds(Math.abs(plannedLeft))}</strong></div>
        <div class="card-row"><span>Actual spending and savings so far</span><strong>${pounds(actual)}</strong></div>
        <div class="card-row"><span>${draft.received !== '' && actualLeft < 0 ? 'Shortfall so far' : 'Left from income received'}</span><strong>${draft.received === '' ? 'Enter income received' : pounds(Math.abs(actualLeft))}</strong></div>
        ${recurringAnnual ? `<p class="muted">At this rate, your planned costs and savings add up to ${pounds(recurringAnnual)} a year.</p>` : ''}
        `;
      const months = monthlySavings ? Math.ceil(leftToSave / monthlySavings) : 0;
      let goalResult = '';
      if (goal && !leftToSave) goalResult = 'Savings goal reached.';
      else if (goal && months) {
        goalResult = `You need ${pounds(leftToSave)} more. At your planned rate, that takes ${months} ${months === 1 ? 'month' : 'months'}.`;
      } else if (goal) {
        goalResult = `You need ${pounds(leftToSave)} more. Add a planned amount to Savings to estimate how long it will take.`;
      }
      form.querySelector('.budget-goal-result').textContent = goalResult;
    }

    function changed() {
      dirty = true;
      status.textContent = 'Unsaved changes.';
      updateSummary();
    }

    for (const [key, id] of Object.entries({
      expected: 'budget-expected', received: 'budget-received',
      target: 'budget-target', alreadySaved: 'budget-saved'
    })) {
      const input = form.querySelector('#' + id);
      input.value = draft[key];
      input.oninput = () => { draft[key] = input.value; changed(); };
    }

    function appendRow(row) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'budget-row';
      fieldset.innerHTML = `<legend></legend>
        <label>Category<input data-key="name" maxlength="50" required></label>
        <label>Planned cost (£)<input data-key="planned" type="number" min="0" max="1000000" step="0.01"></label>
        <label>Frequency<select data-key="frequency"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option></select></label>
        <label>Actual this month (£)<input data-key="actual" type="number" min="0" max="1000000" step="0.01"></label>
        <button type="button" class="btn budget-remove">Remove</button><p class="budget-monthly faint"></p>`;
      const legend = fieldset.querySelector('legend');
      const remove = fieldset.querySelector('button');
      function nameRow() {
        legend.textContent = row.name.trim() || 'New category';
        if (row.savingsGoal && legend.textContent !== 'Savings') legend.textContent += ' (savings goal)';
        remove.setAttribute('aria-label', 'Remove ' + legend.textContent);
      }
      const monthlyHint = fieldset.querySelector('.budget-monthly');
      function updateMonthlyHint() {
        monthlyHint.hidden = !row.planned || !['weekly', 'yearly'].includes(row.frequency);
        monthlyHint.textContent = monthlyHint.hidden ? '' :
          `${pounds(Math.round(amount(row.planned) * frequency[row.frequency] / 12))} per month on average`;
      }
      nameRow();
      updateMonthlyHint();
      for (const input of fieldset.querySelectorAll('[data-key]')) {
        const key = input.dataset.key;
        input.value = row[key] ?? (key === 'frequency' ? 'monthly' : '');
        input.oninput = () => {
          row[key] = input.value;
          if (key === 'name') { nameRow(); refreshCategoryPicker(); }
          updateMonthlyHint();
          changed();
        };
      }
      remove.onclick = () => {
        const nextFocus = fieldset.nextElementSibling?.querySelector('input') || form.querySelector('.budget-add');
        draft.rows.splice(draft.rows.indexOf(row), 1);
        fieldset.remove();
        refreshCategoryPicker();
        changed();
        nextFocus.focus();
      };
      rows.append(fieldset);
      return fieldset;
    }

    draft.rows.forEach(appendRow);
    refreshCategoryPicker();
    form.querySelector('.budget-add').onclick = () => {
      const name = categoryPicker.value;
      const row = { name, savingsGoal: name === 'Savings' };
      draft.rows.push(row);
      appendRow(row).querySelector(name ? '[data-key="planned"]' : '[data-key="name"]').focus();
      refreshCategoryPicker();
      changed();
    };
    form.onsubmit = event => {
      event.preventDefault();
      const unnamed = [...rows.querySelectorAll('[data-key="name"]')].find(input => !input.value.trim());
      if (unnamed) {
        status.textContent = 'Give each category a name before saving.';
        unnamed.focus();
        return;
      }
      try {
        const budgets = readBudgets();
        budgets[selectedMonth] = draft;
        localStorage.setItem(storageKey, JSON.stringify(budgets));
        dirty = false;
        status.textContent = 'Saved on this device.';
        track('personal_budget_saved');
      } catch (_) {
        status.textContent = 'Could not save in this browser. Your entries are still on this page.';
      }
    };
    form.querySelector('.budget-delete').onclick = () => {
      if (!confirm('Clear the budget for this month on this device?')) return;
      try {
        const budgets = readBudgets();
        delete budgets[selectedMonth];
        localStorage.setItem(storageKey, JSON.stringify(budgets));
        loadMonth(selectedMonth);
        renderPersonal(container);
        container.querySelector('#budget-month').focus();
        container.querySelector('.budget-save-status').textContent = 'This month was cleared.';
      } catch (_) {
        status.textContent = 'Could not clear the saved budget.';
      }
    };
    updateSummary();
  }

  window.BasePayBudget = {
    renderPractice,
    renderPersonal,
    resetPractice() { practiceStep = 0; },
    resetSession() { practiceStep = 0; draft = undefined; }
  };
})();

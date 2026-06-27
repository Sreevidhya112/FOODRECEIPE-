let ingredientsList = [];
let expiryPriorities = [];
let activeRecipe = null;
let savedCookbook = JSON.parse(localStorage.getItem('savedCookbook')) || [];

// Speech API references for the Voice Assistant
let recognition = null;
let synth = window.speechSynthesis;
let currentVoiceStepIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initTagInput();
    renderFavorites();
});

function switchTab(tabId, event) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));

    document.getElementById(`${tabId}-tab`).classList.add('active');

    // Explicitly target the clicked button using the passed event or fallbacks
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
}

// --- Dynamic Tag Handling ---
function initTagInput() {
    const input = document.getElementById('ingredientInput');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            let val = input.value.trim().replace(/,/g, '').toLowerCase();
            if (val && !ingredientsList.includes(val)) {
                ingredientsList.push(val);
                renderTags();
                input.value = '';
            }
        }
    });
}

function renderTags() {
    const container = document.getElementById('tagContainer');
    const input = document.getElementById('ingredientInput');
    container.querySelectorAll('.tag').forEach(t => t.remove());
    ingredientsList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tag';
        div.textContent = item;
        const span = document.createElement('span');
        span.innerHTML = '&times;';
        span.onclick = () => {
            ingredientsList = ingredientsList.filter(i => i !== item);
            renderTags();
        };
        div.appendChild(span);
        container.insertBefore(div, input);
    });
}

// --- Expiry Data Tracker Management ---
function addExpiryItem() {
    const nameInput = document.getElementById('expiryName');
    const daysInput = document.getElementById('expiryDays');
    const name = nameInput.value.trim().toLowerCase();
    const days = parseInt(daysInput.value);

    if (name && !isNaN(days)) {
        expiryPriorities.push({ name, days_left: days });
        nameInput.value = '';
        daysInput.value = '';
        renderExpiries();
    }
}

function renderExpiries() {
    const ul = document.getElementById('expiryList');
    ul.innerHTML = '';
    expiryPriorities.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.background = '#334155';
        li.style.padding = '0.25rem 0.5rem';
        li.style.borderRadius = '4px';
        li.style.fontSize = '0.8rem';
        li.textContent = `${item.name} (${item.days_left}d left) `;
        const removeBtn = document.createElement('strong');
        removeBtn.innerHTML = ' &times;';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = () => {
            expiryPriorities.splice(index, 1);
            renderExpiries();
        };
        li.appendChild(removeBtn);
        ul.appendChild(li);
    });
}

// --- Feature 2-6: Advanced Generation Orchestrator Implementation ---
async function triggerAdvancedGeneration() {
    if (!ingredientsList.length) return alert("Please register entry items first.");

    const recipeCard = document.getElementById('recipeCard');
    const loader = document.getElementById('kitchen-loader');

    recipeCard.classList.add('hidden');
    loader.classList.remove('hidden');

    const payload = {
        ingredients: ingredientsList,
        diet: document.getElementById('dietSelect').value,
        expiry_priorities: expiryPriorities,
        servings: parseInt(document.getElementById('servingSelect').value),
        language: "English"
    };

    try {
        const res = await fetch('/generate-advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        activeRecipe = await res.json();
        renderRecipeOutput(activeRecipe);
    } catch (err) {
        alert("Error mapping advanced payload variables structural metrics.");
    } finally {
        loader.classList.add('hidden');
    }
}

function renderRecipeOutput(recipe) {
    document.getElementById('recipeCard').classList.remove('hidden');
    document.getElementById('recipeTitle').textContent = recipe.recipe_name;
    document.getElementById('metaTime').textContent = recipe.cooking_time;
    document.getElementById('metaDiff').textContent = recipe.difficulty;
    document.getElementById('metaCost').textContent = recipe.cost_estimation;

    // Feature 4: Display Nutritional Tracking Panel Elements
    const nutPanel = document.getElementById('nutritionPanel');
    nutPanel.innerHTML = `
        <div class="nut-card"><div class="nut-val">${recipe.nutrition.calories}</div><div class="nut-lbl">Calories</div></div>
        <div class="nut-card"><div class="nut-val">${recipe.nutrition.protein}</div><div class="nut-lbl">Protein</div></div>
        <div class="nut-card"><div class="nut-val">${recipe.nutrition.carbohydrates}</div><div class="nut-lbl">Carbs</div></div>
        <div class="nut-card"><div class="nut-val">${recipe.nutrition.fat}</div><div class="nut-lbl">Fat</div></div>
    `;

    // Feature 5: Smart Substitution Mapping Cards
    const subAlerts = document.getElementById('substitutionAlerts');
    subAlerts.innerHTML = '';
    if (recipe.substitutions && recipe.substitutions.length > 0) {
        subAlerts.innerHTML = '<strong>💡 Recommended Alternative Switches:</strong> ' +
            recipe.substitutions.map(s => `${s.original} &rarr; <b>${s.alternative}</b>`).join(', ');
    } else {
        subAlerts.innerHTML = '✨ Ideal matched pairing options found. No explicit ingredient alternative changes suggested.';
    }

    // Feature 6: Inject Scaled Quantities
    const ingUl = document.getElementById('scaledIngredientsUl');
    ingUl.innerHTML = '';
    recipe.scaled_quantities.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i;
        ingUl.appendChild(li);
    });

    // Feature 9: Shopping List Module Setup
    const shopUl = document.getElementById('shoppingListUl');
    shopUl.innerHTML = '';
    if (recipe.shopping_list.length > 0) {
        document.getElementById('shoppingSection').style.display = 'block';
        recipe.shopping_list.forEach(i => {
            const li = document.createElement('li');
            li.innerHTML = `<input type="checkbox"> ${i}`;
            shopUl.appendChild(li);
        });
    } else {
        document.getElementById('shoppingSection').style.display = 'none';
    }

    // Instructions Checklist Layout Parser Insertion Hooks
    const stepsDiv = document.getElementById('stepsContainer');
    stepsDiv.innerHTML = '';
    recipe.steps.forEach((step, idx) => {
        const label = document.createElement('label');
        label.className = 'step-item';
        label.innerHTML = `<input type="checkbox" onchange="this.parentElement.classList.toggle('completed')"> <span>${idx+1}. ${step}</span>`;
        stepsDiv.appendChild(label);
    });

    currentVoiceStepIndex = 0;
}

// --- Feature 7: Voice Assistant Core Runtime Matrix ---
function startVoiceAssistant() {
    if (!activeRecipe) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition features are not fully supported on this web browser device client environment.");

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log("Voice Engine Track Output Logs matched command token:", command);

        if (command.includes('next') || command.includes('step')) {
            speakNextInstructionStep();
        } else if (command.includes('repeat')) {
            speakCurrentInstructionStep();
        } else if (command.includes('timer')) {
            speakSystemAlert("Setting cooking baseline alert notification frame layer timer target.");
        }
    };

    recognition.start();
    speakSystemAlert("Voice Chef Assistant active. Say next step to continue.");
}

function stopVoiceAssistant() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    synth.cancel();
}

function speakNextInstructionStep() {
    if (!activeRecipe || currentVoiceStepIndex >= activeRecipe.steps.length) {
        speakSystemAlert("Recipe instruction steps are completely processed.");
        return;
    }
    let text = activeRecipe.steps[currentVoiceStepIndex];
    currentVoiceStepIndex++;
    speakSystemAlert(text);
}

function speakCurrentInstructionStep() {
    if (!activeRecipe) return;
    let index = currentVoiceStepIndex > 0 ? currentVoiceStepIndex - 1 : 0;
    speakSystemAlert(activeRecipe.steps[index]);
}

function speakSystemAlert(phrase) {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    synth.speak(utterance);
}

// --- Feature 8: AI Weekly Meal Calendar Planner Layout ---
async function triggerMealPlanGeneration() {
    const container = document.getElementById('mealPlanGrid');
    const loader = document.getElementById('meal-loader');
    container.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const res = await fetch('/generate-meal-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients: ingredientsList, diet: document.getElementById('dietSelect').value })
        });
        const data = await res.json();
        data.plan.forEach(d => {
            const card = document.createElement('div');
            card.className = 'day-card';
            card.innerHTML = `
                <h4>${d.day}</h4>
                <div class="meal-slot">🌅 <b>B:</b> ${d.breakfast}</div>
                <div class="meal-slot">☀️ <b>L:</b> ${d.lunch}</div>
                <div class="meal-slot">🌙 <b>D:</b> ${d.dinner}</div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        alert("Failed to render 7-day calendar view variables context.");
    } finally {
        loader.classList.add('hidden');
    }
}

// --- Feature 9: Download Export as PDF Document Module ---
function downloadShoppingListPDF() {
    const targetElement = document.getElementById('shoppingListUl');
    const configurationOptions = {
        margin: 1,
        filename: 'Your-Smart-Shopping-List.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#131c2e' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(configurationOptions).from(targetElement).save();
}

// --- Feature 10: Persistent Local Storage Cookbook ---
function toggleSaveCurrentRecipe() {
    if (!activeRecipe) return;
    const matchIdx = savedCookbook.findIndex(r => r.recipe_name === activeRecipe.recipe_name);
    if (matchIdx > -1) {
        savedCookbook.splice(matchIdx, 1);
        alert("Recipe removed from your cookbook.");
    } else {
        savedCookbook.push(activeRecipe);
        alert("Recipe successfully saved to your cookbook collection storage arrays!");
    }
    localStorage.setItem('savedCookbook', JSON.stringify(savedCookbook));
    renderFavorites();
}

function renderFavorites() {
    const container = document.getElementById('favoritesContainer');
    container.innerHTML = '';
    if (!savedCookbook.length) {
        container.innerHTML = '<p class="description">No recipes saved to storage yet.</p>';
        return;
    }
    savedCookbook.forEach(recipe => {
        const item = document.createElement('div');
        item.className = 'day-card';
        item.style.cursor = 'pointer';
        item.innerHTML = `<h4>${recipe.recipe_name}</h4><p style="font-size:0.8rem;color:#94a3b8;">⏱️ ${recipe.cooking_time} | ${recipe.difficulty}</p>`;
        item.onclick = (e) => {
            switchTab('kitchen', e);
            activeRecipe = recipe;
            renderRecipeOutput(recipe);
        };
        container.appendChild(item);
    });
}
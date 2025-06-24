document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes e Referências do DOM ---
    const K_CONST = 8.99e9;
    const radius1Input = document.getElementById('radius1'), charge1Input = document.getElementById('charge1');
    const radius2Input = document.getElementById('radius2'), charge2Input = document.getElementById('charge2');
    const calculateBtn = document.getElementById('calculate-btn'), errorMessage = document.getElementById('error-message');
    const svg = document.getElementById('simulation-svg'), svgNS = "http://www.w3.org/2000/svg";
    const resultQ1 = document.querySelector('#result-q1 .value'), resultQ2 = document.querySelector('#result-q2 .value'), resultV = document.querySelector('#result-v .value');

    // Variáveis de controle da animação
    let animationFrameId = null;
    let particleSpawner = null;

    // --- Funções Auxiliares e de Cálculo ---
    function validateInputs() {
        errorMessage.textContent = '';
        const inputs = [radius1Input, charge1Input, radius2Input, charge2Input];
        for (const input of inputs) {
            if (input.value.trim() === '') {
                errorMessage.textContent = 'Todos os campos são obrigatórios.';
                input.focus();
                return false;
            }
        }
        if (parseFloat(radius1Input.value) <= 0 || parseFloat(radius2Input.value) <= 0) {
            errorMessage.textContent = 'O raio deve ser um valor positivo.';
            return false;
        }
        return true;
    }
    function getChargeClass(charge) {
        if (Math.abs(charge) < 1e-9) return 'neutral';
        return charge > 0 ? 'positive' : 'negative';
    }
    function calculateEquilibrium(r1, q1, r2, q2) {
        const R1 = r1 * 1e-2, Q1 = q1 * 1e-6, R2 = r2 * 1e-2, Q2 = q2 * 1e-6;
        const Qt = Q1 + Q2, R_total = R1 + R2;
        const v_final = (R_total === 0) ? 0 : K_CONST * Qt / R_total;
        const q1_final = (R_total === 0) ? 0 : Qt * (R1 / R_total);
        const q2_final = (R_total === 0) ? 0 : Qt * (R2 / R_total);
        return { q1_final: q1_final * 1e6, q2_final: q2_final * 1e6, v_final: v_final };
    }
    
    // --- LÓGICA DE VISUALIZAÇÃO E ANIMAÇÃO ---

    function stopAnimation() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (particleSpawner) clearInterval(particleSpawner);
        const existingParticles = document.querySelectorAll('.electron-particle');
        existingParticles.forEach(p => p.remove());
        animationFrameId = null;
        particleSpawner = null;
    }

    function drawScene(state) {
        stopAnimation();
        svg.innerHTML = '';
        const { width, height } = svg.getBoundingClientRect();
        
        const yPos = height / 2;
        // Garante que o raio mínimo para escala seja 1, para evitar divisão por zero se ambos forem 0
        const maxInputRadius = Math.max(state.r1, state.r2, 1);
        const maxSvgRadius = Math.min(width / 5, height / 3);
        const scale = maxSvgRadius / maxInputRadius;

        // Garante que o raio visual nunca seja menor que 2px para a esfera não sumir
        const r1_s = Math.max(2, state.r1 * scale);
        const r2_s = Math.max(2, state.r2 * scale);
        const cx1 = width * 0.25, cx2 = width * 0.75;

        const wire = document.createElementNS(svgNS, 'line');
        wire.setAttribute('x1', cx1); wire.setAttribute('y1', yPos);
        wire.setAttribute('x2', cx2); wire.setAttribute('y2', yPos);
        wire.setAttribute('class', 'wire');
        svg.appendChild(wire);

        const createSphere = (id, cx, r_scaled, charge) => {
            const group = document.createElementNS(svgNS, 'g');
            const sphere = document.createElementNS(svgNS, 'circle');
            sphere.setAttribute('id', `sphere-${id}`);
            sphere.setAttribute('cx', cx); sphere.setAttribute('cy', yPos);
            sphere.setAttribute('r', r_scaled);
            sphere.setAttribute('class', `sphere ${getChargeClass(charge)}`);
            
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', cx); label.setAttribute('y', yPos - r_scaled - 30);
            label.setAttribute('class', 'sphere-label');
            label.textContent = `Esfera ${id}`;

            const chargeLabel = document.createElementNS(svgNS, 'text');
            chargeLabel.setAttribute('id', `charge-label-${id}`);
            chargeLabel.setAttribute('x', cx); chargeLabel.setAttribute('y', yPos - r_scaled - 10);
            chargeLabel.setAttribute('class', 'charge-value');
            chargeLabel.textContent = `${charge.toFixed(2)} µC`;
            
            group.append(sphere, label, chargeLabel);
            svg.appendChild(group);
        };
        
        createSphere('1', cx1, r1_s, state.q1);
        createSphere('2', cx2, r2_s, state.q2);
    }

    function animateConnection(initialState, finalState) { /* ...código da animação inalterado... */ 
        stopAnimation();
        calculateBtn.disabled = true;
        calculateBtn.textContent = 'TRANSFERINDO...';
        const { width, height } = svg.getBoundingClientRect();
        const yPos = height / 2;
        const maxR = Math.min(width / 5, height / 3);
        const scale = maxR / Math.max(initialState.r1, initialState.r2, 1);
        const r1_s = Math.max(2, initialState.r1 * scale);
        const r2_s = Math.max(2, initialState.r2 * scale);
        const cx1 = width * 0.25, cx2 = width * 0.75;
        const V1 = (initialState.r1 === 0) ? 0 : K_CONST * (initialState.q1 * 1e-6) / (initialState.r1 * 1e-2);
        const V2 = (initialState.r2 === 0) ? 0 : K_CONST * (initialState.q2 * 1e-6) / (initialState.r2 * 1e-2);
        const flowFrom1To2 = V1 < V2;
        const startX = flowFrom1To2 ? cx1 + r1_s : cx2 - r2_s;
        const endX = flowFrom1To2 ? cx2 - r2_s : cx1 + r1_s;
        let particles = [];
        const totalParticles = 40;
        const animationDuration = 1200;
        const particleSpeed = (endX - startX) / animationDuration;
        let particlesSpawned = 0;
        particleSpawner = setInterval(() => {
            if (particlesSpawned >= totalParticles) {
                clearInterval(particleSpawner);
                particleSpawner = null;
                return;
            }
            const yOffset = (Math.random() - 0.5) * 25;
            const pY = yPos + yOffset;
            particles.push({ x: startX, y: pY, element: createParticle(startX, pY) });
            particlesSpawned++;
        }, 25);
        let lastTime = 0;
        function animationLoop(currentTime) {
            if (!lastTime) lastTime = currentTime;
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            particles.forEach((p, index) => {
                p.x += particleSpeed * deltaTime;
                p.element.setAttribute('cx', p.x);
                if ((flowFrom1To2 && p.x >= endX) || (!flowFrom1To2 && p.x <= endX)) {
                    p.element.remove();
                    particles.splice(index, 1);
                }
            });
            if (particles.length > 0 || particleSpawner) {
                animationFrameId = requestAnimationFrame(animationLoop);
            } else {
                updateToFinalState(finalState);
            }
        }
        animationFrameId = requestAnimationFrame(animationLoop);
    }
    
    function createParticle(x, y) { /* ...código inalterado... */
        const p = document.createElementNS(svgNS, 'circle');
        p.setAttribute('cx', x);
        p.setAttribute('cy', y);
        p.setAttribute('r', '4');
        p.setAttribute('class', 'electron-particle');
        svg.appendChild(p);
        return p;
    }

    function updateToFinalState(finalState) { /* ...código inalterado... */
        document.getElementById('sphere-1').setAttribute('class', `sphere ${getChargeClass(finalState.q1_final)}`);
        document.getElementById('sphere-2').setAttribute('class', `sphere ${getChargeClass(finalState.q2_final)}`);
        document.getElementById('charge-label-1').textContent = `${finalState.q1_final.toFixed(2)} µC`;
        document.getElementById('charge-label-2').textContent = `${finalState.q2_final.toFixed(2)} µC`;
        resultQ1.textContent = `${finalState.q1_final.toFixed(2)} µC`;
        resultQ2.textContent = `${finalState.q2_final.toFixed(2)} µC`;
        resultV.textContent = `${finalState.v_final.toExponential(2)} V`;
        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Conectar e Calcular';
        animationFrameId = null;
    }

    // --- Lógica Principal e Event Listeners ---

    function handleCalculation() {
        if (!validateInputs()) return;
        
        const initialState = {
            r1: parseFloat(radius1Input.value) || 0,
            q1: parseFloat(charge1Input.value) || 0,
            r2: parseFloat(radius2Input.value) || 0,
            q2: parseFloat(charge2Input.value) || 0
        };
        
        drawScene(initialState); // Garante que a cena está correta antes de animar
        const finalState = calculateEquilibrium(initialState.r1, initialState.q1, initialState.r2, initialState.q2);

        const V1 = (initialState.r1 === 0) ? 0 : K_CONST * (initialState.q1 * 1e-6) / (initialState.r1 * 1e-2);
        const V2 = (initialState.r2 === 0) ? 0 : K_CONST * (initialState.q2 * 1e-6) / (initialState.r2 * 1e-2);
        if (Math.abs(V1 - V2) < 1e-3) {
            updateToFinalState(finalState);
            return;
        }

        animateConnection(initialState, finalState);
    }
    
    // ### NOVO: Função para atualizar a visualização em tempo real ###
    function updateRealTimeVisuals() {
        // Para qualquer animação em andamento
        stopAnimation();

        // Limpa os resultados do cálculo anterior
        resultQ1.textContent = '-- µC';
        resultQ2.textContent = '-- µC';
        resultV.textContent = '-- V';
        errorMessage.textContent = ''; // Limpa mensagens de erro
        
        // Lê os valores atuais, tratando campos vazios como 0
        const currentState = {
            r1: parseFloat(radius1Input.value) || 0,
            q1: parseFloat(charge1Input.value) || 0,
            r2: parseFloat(radius2Input.value) || 0,
            q2: parseFloat(charge2Input.value) || 0
        };
        
        // Redesenha a cena
        drawScene(currentState);
    }

    calculateBtn.addEventListener('click', handleCalculation);
    window.addEventListener('resize', updateRealTimeVisuals); // Reutiliza a função para redimensionar

    // ### NOVO: Adiciona os listeners para os eventos 'input' ###
    radius1Input.addEventListener('input', updateRealTimeVisuals);
    charge1Input.addEventListener('input', updateRealTimeVisuals);
    radius2Input.addEventListener('input', updateRealTimeVisuals);
    charge2Input.addEventListener('input', updateRealTimeVisuals);

    // --- Execução Inicial ---
    // Chama a função de atualização para desenhar o estado inicial da página
    updateRealTimeVisuals();
});
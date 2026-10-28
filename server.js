// Particles Animation
(function(){
    var c = document.getElementById('bg-canvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    function resize(){ c.width = window.innerWidth; c.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    var p = [];
    for (var i = 0; i < 70; i++) {
        p.push({ x: Math.random()*c.width, y: Math.random()*c.height, r: Math.random()*1.5+0.5, vy: -Math.random()*0.5-0.1, a: Math.random()*0.4+0.1 });
    }
    function loop(){
        ctx.clearRect(0,0,c.width,c.height);
        for (var i = 0; i < p.length; i++) {
            var q = p[i];
            q.y += q.vy;
            if (q.y < 0) q.y = c.height;
            ctx.beginPath();
            ctx.arc(q.x, q.y, q.r, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,0,43,'+q.a+')';
            ctx.fill();
        }
        requestAnimationFrame(loop);
    }
    loop();
})();

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.querySelector('.nav-btn[data-tab="' + name + '"]').classList.add('active');
    if(name === 'illegal') loadGangs();
    if(name === 'shop') loadShop();
    if(name === 'admin') loadAdmin();
    if(name === 'streamers') loadStreamers();
}
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', function(){ switchTab(this.getAttribute('data-tab')); }));

document.getElementById('copyBtn').addEventListener('click', function(){
    var ip = document.getElementById('serverIP').innerText;
    if (navigator.clipboard) navigator.clipboard.writeText(ip);
    var t = this;
    var old = t.innerHTML;
    t.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => t.innerHTML = old, 2000);
});

// App Configs
const appConfigs = {
    "Whitelist App": { title: "WHITELIST", color: "#ff002b", icon: "fa-regular fa-user", fields: [
        { label: "CHARACTER NAME *", type: "input", name: "char_name", placeholder: "First Last", required: true },
        { label: "AGE *", type: "number", name: "age", placeholder: "Your age", required: true },
        { label: "DISCORD ID *", type: "input", name: "discord_id", placeholder: "e.g. 1234567890", required: true },
        { label: "BACKSTORY *", type: "textarea", name: "backstory", placeholder: "Tell us your story...", required: true }
    ]},
    "Gang & Family App": { title: "GANG & FAMILY", color: "#ff7a1a", icon: "fa-solid fa-crosshairs", fields: [
        { label: "GANG NAME *", type: "input", name: "gang_name", placeholder: "Name", required: true },
        { label: "GANG COLOR *", type: "input", name: "gang_color", placeholder: "#FF7A1A", required: true },
        { label: "MEMBERS IDS *", type: "textarea", name: "members_ids", placeholder: "8+ IDs...", required: true },
        { label: "OBJECTIVE *", type: "textarea", name: "gang_objective", placeholder: "Goals...", required: true }
    ]},
    "Police App": { title: "POLICE DEPT", color: "#3b82f6", icon: "fa-solid fa-shield-halved", fields: [
        { label: "NAME *", type: "input", name: "char_name", placeholder: "First Last", required: true },
        { label: "AGE *", type: "number", name: "age", placeholder: "Age", required: true },
        { label: "WHY PD? *", type: "textarea", name: "motivation", placeholder: "Motivation...", required: true },
        { label: "EXPERIENCE *", type: "textarea", name: "experience", placeholder: "Experience...", required: true }
    ]},
    "EMS App": { title: "EMS DEPT", color: "#10b981", icon: "fa-solid fa-briefcase-medical", fields: [
        { label: "NAME *", type: "input", name: "char_name", placeholder: "First Last", required: true },
        { label: "AGE *", type: "number", name: "age", placeholder: "Age", required: true },
        { label: "WHY EMS? *", type: "textarea", name: "motivation", placeholder: "Motivation...", required: true },
        { label: "EXPERIENCE *", type: "textarea", name: "experience", placeholder: "Experience...", required: true }
    ]},
    "Creator App": { title: "CREATOR", color: "#a855f7", icon: "fa-solid fa-video", fields: [
        { label: "CHANNEL NAME *", type: "input", name: "channel_name", placeholder: "Name", required: true },
        { label: "PLATFORM *", type: "select", name: "platform", options: ["Twitch", "YouTube", "Kick"], required: true },
        { label: "CHANNEL URL *", type: "input", name: "channel_url", placeholder: "https://...", required: true },
        { label: "EXPERIENCE *", type: "textarea", name: "experience", placeholder: "Avg viewers...", required: true }
    ]}
};

let currentType = '';
function openModal(title) {
    currentType = title;
    const config = appConfigs[title] || { title: "SUPPORT", color: "#ff002b", icon: "fa-solid fa-headset", fields: [] };
    
    document.getElementById('modalTitle').innerText = config.title;
    document.getElementById('modalHeaderIcon').innerHTML = config.icon ? `<i class="${config.icon}" style="color: ${config.color}"></i>` : '';
    document.getElementById('modalCardBody').style.borderTop = `4px solid ${config.color}`;
    document.getElementById('submitFormBtn').style.background = config.color;

    const fieldsContainer = document.getElementById('dynamicFormFields');
    fieldsContainer.innerHTML = '';

    config.fields.forEach(f => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const label = document.createElement('label');
        label.className = 'form-label';
        label.innerText = f.label;
        group.appendChild(label);

        let input;
        if (f.type === 'textarea') {
            input = document.createElement('textarea'); input.className = 'form-input form-textarea';
        } else if (f.type === 'select') {
            input = document.createElement('select'); input.className = 'form-input';
            f.options.forEach(opt => { const o = document.createElement('option'); o.value = opt; o.innerText = opt; input.appendChild(o); });
        } else {
            input = document.createElement('input'); input.type = f.type || 'text'; input.className = 'form-input';
        }
        input.name = f.name; input.placeholder = f.placeholder || '';
        if (f.required) input.required = true;
        group.appendChild(input);
        fieldsContainer.appendChild(group);
    });

    document.getElementById('ticketModal').classList.add('active');
}

function closeModal() { document.getElementById('ticketModal').classList.remove('active'); }
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('ticketModal').addEventListener('click', function(e){ if (e.target === this) closeModal(); });

document.querySelectorAll('[data-app]').forEach(el => {
    el.addEventListener('click', function(){ openModal(this.getAttribute('data-app')); });
});

document.getElementById('ticketForm').addEventListener('submit', async function(e){
    e.preventDefault();
    const formData = new FormData(this); const dataObj = {};
    formData.forEach((value, key) => dataObj[key] = value);
    await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: currentType, subject: dataObj.discord_id || dataObj.char_name || 'N/A', message: JSON.stringify(dataObj) })
    });
    alert('✅ Submitted!');
    closeModal(); this.reset();
});

// FiveM Stats
async function loadStats() {
    try {
        const res = await fetch('/api/stats'); const data = await res.json();
        document.getElementById('statusText').textContent = data.online ? 'Server Online' : 'Server Offline';
        document.getElementById('playerCount').textContent = `${data.players} / ${data.maxPlayers}`;
        document.getElementById('serverName').textContent = data.name;
        document.getElementById('serverIP').textContent = data.ip;
        document.getElementById('barFill').style.width = (data.players / data.maxPlayers * 100) + '%';
    } catch(e) {}
}
loadStats();

// Load Gangs
async function loadGangs() {
    try {
        const res = await fetch('/api/gangs'); const gangs = await res.json();
        document.getElementById('gangsGrid').innerHTML = gangs.length ? gangs.map(g => `
            <div class="gang-card">
                <div class="gang-header">
                    <div class="gang-logo">${g.logo || 'G'}</div>
                    <div>
                        <div class="gang-title">${g.name}</div>
                        <div class="gang-members-count">${g.members.length} MEMBERS</div>
                    </div>
                </div>
                <div class="gang-roster">
                    ${(g.boss ? `<div class="gang-member"><img src="https://cdn.discordapp.com/embed/avatars/0.png" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"><span class="gang-member-name">${g.boss}</span></div>` : '')}
                    ${(g.underboss ? `<div class="gang-member"><img src="https://cdn.discordapp.com/embed/avatars/0.png" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"><span class="gang-member-name">${g.underboss}</span></div>` : '')}
                    ${(g.members || []).map(m => `<div class="gang-member"><img src="${m.avatar}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"><span class="gang-member-name">${m.name || 'Member'}</span></div>`).join('')}
                </div>
            </div>`).join('') : '<p>No gangs.</p>';
    } catch(e){}
}

// Load Streamers
async function loadStreamers() {
    try {
        const res = await fetch('/api/streamers'); const streamers = await res.json();
        document.getElementById('streamersGrid').innerHTML = streamers.length ? streamers.map(s => {
            const isLive = s.isLive === true;
            return `
            <a href="${s.url}" target="_blank" class="streamer-card ${isLive ? 'live' : 'offline'}">
                <div class="streamer-img">
                    <span class="${isLive ? 'live-badge' : 'offline-badge'}">${isLive ? 'LIVE' : 'OFFLINE'}</span>
                    <img src="${s.image}">
                </div>
                <div class="streamer-info">
                    <span class="streamer-name">${s.name}</span>
                    <div class="live-dot"></div>
                </div>
            </a>
            `;
        }).join('') : '<p>No streamers.</p>';
    } catch(e){}
}

// Load Shop
async function loadShop() {
    try {
        const res = await fetch('/api/shop'); const items = await res.json();
        document.getElementById('shopGrid').innerHTML = items.length ? items.map(i => `
            <div class="shop-item">
                <div class="shop-img"><img src="${i.image}"></div>
                <div class="shop-body"><div class="shop-price">${i.price} DT</div><div class="shop-title">${i.name}</div></div>
            </div>`).join('') : '<p>Shop empty.</p>';
    } catch(e){}
}

// Admin
document.getElementById('adminLoginBtn').addEventListener('click', async function(){
    const pass = document.getElementById('adminPassword').value;
    const res = await fetch('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
    if(res.ok) {
        document.getElementById('adminLoginView').style.display = 'none';
        document.getElementById('adminPanelView').style.display = 'block';
        loadAdmin();
    } else alert('Wrong Password');
});
document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    document.getElementById('adminLoginView').style.display = 'block';
    document.getElementById('adminPanelView').style.display = 'none';
});

async function loadAdmin() {
    // Tickets
    const t = await (await fetch('/api/tickets')).json();
    let html = '';
    t.forEach(x => {
        let details = '';
        try { let parsed = JSON.parse(x.message); details = Object.entries(parsed).map(([k,v]) => `<b>${k}:</b> ${v}`).join('<br>'); } 
        catch(e) { details = x.message; }
        
        let statusColor = x.status === 'accepted' ? '#22c55e' : x.status === 'rejected' ? '#ff002b' : '#f59e0b';
        let actionBtns = x.status === 'pending' ? `<button class="accept" onclick="updateTicket('${x.id}', 'accepted')">Accept</button><button class="reject" onclick="updateTicket('${x.id}', 'rejected')">Reject</button>` : '';
        
        html += `<div style="background:#111; border:1px solid #333; padding:1rem; margin-bottom:1rem; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <strong style="color:var(--primary); font-family:var(--font-title); font-size:1.3rem;">${x.type}</strong>
                <span style="color:${statusColor}; font-weight:bold;">${x.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.9rem; color:#ccc; margin-bottom:0.5rem; line-height:1.4;">${details}</div>
            ${x.reason ? `<div style="color:#ff5555; font-size:0.9rem; margin-bottom:0.5rem;"><b>Reason:</b> ${x.reason}</div>` : ''}
            <div>${actionBtns}</div>
        </div>`;
    });
    document.getElementById('adminTickets').innerHTML = t.length ? html : 'No tickets.';

    // Gangs
    const g = await (await fetch('/api/gangs')).json();
    document.getElementById('adminGangs').innerHTML = g.length ? `<table class="admin-table">${g.map(x=>`
        <tr>
            <td>${x.name}</td>
            <td>${x.members.length} m</td>
            <td>
                <button onclick="addMember('${x.id}')">Add Member</button>
                <button class="reject" onclick="removeGang('${x.id}')">Delete Gang</button>
            </td>
        </tr>`).join('')}</table>` : 'No gangs.';

    // Shop
    const s = await (await fetch('/api/shop')).json();
    document.getElementById('adminShop').innerHTML = s.length ? `<table class="admin-table">${s.map(x=>`<tr><td>${x.name}</td><td>${x.price} DT</td></tr>`).join('')}</table>` : 'Empty.';

    // Streamers
    const st = await (await fetch('/api/streamers')).json();
    document.getElementById('adminStreamers').innerHTML = st.length ? `<table class="admin-table">${st.map(x=>`<tr><td>${x.name}</td><td>${x.url}</td><td><button onclick="removeStreamer('${x.id}')">Delete</button></td></tr>`).join('')}</table>` : 'Empty.';
}

async function updateTicket(id, st) { 
    let reason = '';
    if (st === 'rejected') {
        reason = prompt("Reason for rejection:");
        if (reason === null) return;
    }
    await fetch('/api/tickets/'+id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:st, reason:reason})}); 
    loadAdmin(); 
}

// إضافة جانغ جديد
document.getElementById('addGangBtn').addEventListener('click', async function(){ 
    const name = document.getElementById('newGangName').value;
    const boss = document.getElementById('newGangBoss').value;
    const bossId = document.getElementById('newGangBossId').value;
    const underboss = document.getElementById('newGangUnderboss').value;
    const underbossId = document.getElementById('newGangUnderbossId').value;

    if(!name) return alert('Gang name is required');
    if(!boss) return alert('Boss name is required');
    if(!bossId) return alert('Boss ID is required');
    if(!underboss) return alert('Underboss name is required');
    if(!underbossId) return alert('Underboss ID is required');

    await fetch('/api/gangs', {
        method:'POST', headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({
            name: name, 
            boss: boss, 
            bossId: bossId,
            underboss: underboss, 
            underbossId: underbossId
        })
    }); 
    loadAdmin(); 
});

// مسح الجانغ
async function removeGang(id) {
    if(confirm('Are you sure you want to delete this gang?')) {
        await fetch('/api/gangs/'+id, {method:'DELETE'});
        loadAdmin();
    }
}

async function addMember(id) { 
    const discordId = prompt("Discord ID (e.g. 1234567890):"); 
    if(!discordId) return;

    const memberName = prompt("Member Name (e.g. John):") || 'Member';
    const avatar = prompt("Member Avatar URL (Copy the link from Discord):");

    if(!avatar) {
        alert("You must provide an Avatar URL for the image to show up.");
        return;
    }

    await fetch('/api/gangs/'+id+'/members', {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({
            discordId: discordId, 
            memberName: memberName, 
            avatar: avatar
        })
    }); 
    loadAdmin(); 
}

document.getElementById('addShopBtn').addEventListener('click', async function(){ 
    await fetch('/api/shop', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:document.getElementById('newShopName').value, price:parseInt(document.getElementById('newShopPrice').value), image:document.getElementById('newShopImage').value})}); 
    loadAdmin(); 
});
document.getElementById('addStreamerBtn').addEventListener('click', async function(){ 
    const isLive = document.getElementById('newStreamerLive').checked;
    await fetch('/api/streamers', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:document.getElementById('newStreamerName').value, url:document.getElementById('newStreamerUrl').value, image:document.getElementById('newStreamerImage').value, isLive: isLive})}); 
    loadAdmin(); 
});
async function removeStreamer(id) {
    if(confirm('Delete Streamer?')) {
        await fetch('/api/streamers/'+id, {method:'DELETE'});
        loadAdmin();
    }
}

// Auth
document.getElementById('loginBtn').addEventListener('click', () => window.location.href = '/api/auth/discord');
async function checkLogin() {
    const res = await fetch('/api/auth/me'); const data = await res.json();
    if (data.loggedIn) {
        document.getElementById('userArea').innerHTML = `<div class="user-profile" onclick="window.location.href='/api/auth/logout'"><img src="https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png"><span>${data.username}</span></div>`;
    }
}
checkLogin();

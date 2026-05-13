// --- STATE MANAGEMENT ---
let currentUser = null;
let authToken = localStorage.getItem('nexus_token');
let stompClient = null;

let currentChat = {
    type: null, // 'ROOM' or 'DIRECT'
    id: null,   // Target Room ID or Target User ID
    name: null,
    chatId: null, // Subscribed topic channel ID
    subscription: null,
    typingSubscription: null
};

let stagedFile = null;
let typingTimeout = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // If token exists, attempt auto-login
    if (authToken) {
        fetchCurrentUser();
    }
});

// --- AUTHENTICATION FLOWS ---

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        document.querySelector('.auth-tabs button:nth-child(1)').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelector('.auth-tabs button:nth-child(2)').classList.add('active');
        document.getElementById('signup-form').classList.add('active');
    }
}

function selectAvatar(element, seed) {
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('signup-avatar').value = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
}

async function handleSignup(event) {
    event.preventDefault();
    const errorDiv = document.getElementById('signup-error');
    errorDiv.innerText = '';

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const avatarUrl = document.getElementById('signup-avatar').value;

    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, avatarUrl })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        // Successfully registered and logged in
        saveAuthSession(data.token, data.user);
    } catch (err) {
        errorDiv.innerText = err.message;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const errorDiv = document.getElementById('login-error');
    errorDiv.innerText = '';

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Invalid credentials');
        }

        saveAuthSession(data.token, data.user);
    } catch (err) {
        errorDiv.innerText = err.message;
    }
}

function saveAuthSession(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('nexus_token', token);
    
    // Switch UI views
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    // Populate sidebar info
    document.getElementById('current-user-name').innerText = user.username;
    document.getElementById('current-user-avatar').src = user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

    // Load available workspace environments
    loadChannels();
    loadUsers();

    // Establish persistent interactive WebSocket channel
    connectWebSocket();
}

async function fetchCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const user = await response.json();
            saveAuthSession(authToken, user);
        } else {
            logout();
        }
    } catch (err) {
        console.error('Session retrieval error', err);
        logout();
    }
}

function logout() {
    if (stompClient) {
        stompClient.disconnect();
    }
    authToken = null;
    currentUser = null;
    localStorage.removeItem('nexus_token');

    // Revert visual workspace
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    
    // Reset current selected chat state
    currentChat.type = null;
    currentChat.id = null;
    currentChat.chatId = null;
}

// --- WORKSPACE DATA LOADING ---

async function loadChannels() {
    try {
        const response = await fetch('/api/chats/rooms', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const rooms = await response.json();
            const list = document.getElementById('channels-list');
            list.innerHTML = '';
            
            rooms.forEach(room => {
                const li = document.createElement('li');
                li.className = `nav-item ${currentChat.id === room.id ? 'active' : ''}`;
                li.innerHTML = `<i class="fa-solid fa-hashtag"></i> <span>${room.name}</span>`;
                li.onclick = () => selectChatTarget('ROOM', room.id, room.name);
                list.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Failed to parse chat rooms', err);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const users = await response.json();
            const list = document.getElementById('users-list');
            list.innerHTML = '';

            // Filter out self
            const peers = users.filter(u => u.id !== currentUser.id);
            document.getElementById('users-count').innerText = peers.length;

            peers.forEach(user => {
                const isOnline = user.status === 'ONLINE';
                const li = document.createElement('li');
                li.className = `nav-item ${currentChat.id === user.id ? 'active' : ''}`;
                li.id = `peer-item-${user.id}`;
                li.innerHTML = `
                    <img src="${user.avatarUrl}" class="nav-avatar" alt="${user.username}">
                    <span>${user.username}</span>
                    <div class="nav-status ${isOnline ? 'online' : 'offline'}"></div>
                `;
                li.onclick = () => selectChatTarget('DIRECT', user.id, user.username, user.avatarUrl);
                list.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Failed to load peers', err);
    }
}

// --- WEBSOCKET REAL-TIME BROKER SETUP ---

function connectWebSocket() {
    // Instantiate raw bidirectional fallback engine
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    
    // Suppress heavy console debug trace
    stompClient.debug = null;

    // Connect with credential envelope headers
    stompClient.connect({ 'Authorization': `Bearer ${authToken}` }, (frame) => {
        console.log('Nexus WebSocket core established: ' + frame);

        // Global status monitor listener
        stompClient.subscribe('/topic/users/status', (message) => {
            const statusUpdate = JSON.parse(message.body);
            updatePeerPresence(statusUpdate.userId, statusUpdate.status);
        });

        // If a chat target is pre-selected, bind subscription instantly
        if (currentChat.chatId) {
            bindChatSubscriptions(currentChat.chatId);
        }
    }, (error) => {
        console.error('WebSocket connection broken', error);
        // Attempt clean reconnection after delay
        setTimeout(() => { if (authToken) connectWebSocket(); }, 5000);
    });
}

function updatePeerPresence(userId, status) {
    const peerElement = document.getElementById(`peer-item-${userId}`);
    if (peerElement) {
        const dot = peerElement.querySelector('.nav-status');
        if (dot) {
            dot.className = `nav-status ${status === 'ONLINE' ? 'online' : 'offline'}`;
        }
    }
}

// --- ACTIVE TARGET SWITCHING ---

async function selectChatTarget(type, id, name, avatarUrl = '') {
    // Highlight sidebar active selection
    currentChat.type = type;
    currentChat.id = id;
    currentChat.name = name;

    // Refresh active state visually
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // We can also trigger reload or manual addition
    loadChannels();
    loadUsers();

    // Prepare workspace target layout
    document.getElementById('chat-target-name').innerText = type === 'ROOM' ? `# ${name}` : name;
    document.getElementById('chat-target-status').innerText = type === 'ROOM' ? 'Public collaborative channel' : 'Direct encrypted connection';
    
    const iconWrapper = document.getElementById('chat-header-icon');
    if (type === 'ROOM') {
        iconWrapper.innerHTML = '<i class="fa-solid fa-hashtag"></i>';
    } else {
        iconWrapper.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    }

    // Determine deterministic synchronous chatId matching Backend symmetric strategy
    let targetChatId;
    if (type === 'ROOM') {
        targetChatId = id;
    } else {
        // Direct composite ID ordered alphabetically
        targetChatId = currentUser.id.localeCompare(id) < 0 
            ? `${currentUser.id}_${id}` 
            : `${id}_${currentUser.id}`;
    }

    // Unsubscribe from previous conversation streams
    if (currentChat.subscription) {
        currentChat.subscription.unsubscribe();
    }
    if (currentChat.typingSubscription) {
        currentChat.typingSubscription.unsubscribe();
    }

    currentChat.chatId = targetChatId;

    // Fetch message historical catalog
    await fetchAndRenderHistory(targetChatId, type, id);

    // Bind real-time STOMP route subscriptions
    if (stompClient && stompClient.connected) {
        bindChatSubscriptions(targetChatId);
    }
}

function bindChatSubscriptions(chatId) {
    // Primary Broadcast message pipeline
    currentChat.subscription = stompClient.subscribe(`/topic/chat/${chatId}`, (message) => {
        const incomingMessage = JSON.parse(message.body);
        appendMessageBubble(incomingMessage);
        scrollToBottom();
    });

    // Auxiliary Typing Indicator telemetry pipeline
    currentChat.typingSubscription = stompClient.subscribe(`/topic/chat/${chatId}/typing`, (message) => {
        const indicator = JSON.parse(message.body);
        // Exclude our own emitted frame
        if (indicator.senderId !== currentUser.id) {
            displayTypingNotice(indicator.senderUsername);
        }
    });
}

async function fetchAndRenderHistory(chatId, type, targetId) {
    const pane = document.getElementById('messages-pane');
    pane.innerHTML = ''; // Wipe preloader splash

    let url = type === 'ROOM' 
        ? `/api/chats/history/${chatId}` 
        : `/api/chats/direct/${currentUser.id}/${targetId}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const history = await response.json();
            if (history.length === 0) {
                // Empty view state
                pane.innerHTML = `
                    <div class="welcome-splash" style="margin-top:auto; margin-bottom:auto;">
                        <i class="fa-solid fa-seedling splash-icon" style="font-size:2rem; opacity:0.6;"></i>
                        <h4 style="color:var(--text-muted);">Conversation Initialized</h4>
                        <p style="font-size:0.8rem;">Send the first message below to commence interaction.</p>
                    </div>
                `;
            } else {
                history.forEach(msg => appendMessageBubble(msg));
                scrollToBottom();
            }
        }
    } catch (err) {
        console.error('Failed to load past conversation history', err);
    }
}

// --- MESSAGE RENDERING ENGINE ---

function appendMessageBubble(msg) {
    const pane = document.getElementById('messages-pane');
    
    // Clear welcome/empty state view if present
    const splash = pane.querySelector('.welcome-splash');
    if (splash) splash.remove();

    const isOutgoing = msg.senderId === currentUser.id;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

    // Sender custom avatar mapping
    const avatarUrl = msg.senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderUsername}`;

    let attachmentHtml = '';
    if (msg.fileUrl) {
        // Detect native renderable images vs auxiliary download files
        const isImage = msg.fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileName);
        if (isImage) {
            // Append optional parameter token to facilitate inline media server retrieval
            const secureUrl = `${msg.fileUrl}?token=${authToken}`;
            attachmentHtml = `
                <div class="msg-attachment">
                    <img src="${secureUrl}" class="msg-image" alt="${msg.fileName}" onclick="window.open('${secureUrl}', '_blank')">
                </div>
            `;
        } else {
            const secureUrl = `${msg.fileUrl}?token=${authToken}`;
            attachmentHtml = `
                <div class="msg-attachment">
                    <a href="${secureUrl}" class="msg-file-link" target="_blank" download>
                        <i class="fa-solid fa-file-arrow-down" style="font-size:1.2rem; color:var(--primary);"></i>
                        <span>${msg.fileName}</span>
                    </a>
                </div>
            `;
        }
    }

    row.innerHTML = `
        <img src="${avatarUrl}" class="msg-avatar" alt="${msg.senderUsername}">
        <div class="msg-content">
            <div class="msg-meta">
                <span class="msg-sender">${isOutgoing ? 'You' : msg.senderUsername}</span>
                <span>•</span>
                <span>${timeStr}</span>
            </div>
            ${msg.content && msg.content.trim() !== '' ? `<div class="msg-bubble">${escapeHtml(msg.content)}</div>` : ''}
            ${attachmentHtml}
        </div>
    `;

    pane.appendChild(row);
}

function scrollToBottom() {
    const pane = document.getElementById('messages-pane');
    pane.scrollTop = pane.scrollHeight;
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- FILE UPLOAD PIPELINE ---

function triggerFileInput() {
    document.getElementById('file-input').click();
}

function handleFileSelection(event) {
    const files = event.target.files;
    if (files.length > 0) {
        stagedFile = files[0];
        document.getElementById('staged-file-name').innerText = stagedFile.name;
        document.getElementById('file-preview-bar').classList.remove('hidden');
    }
}

function clearStagedFile() {
    stagedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-preview-bar').classList.add('hidden');
}

// --- EMOJI QUICK TOOL ---

function insertEmoji(char) {
    const input = document.getElementById('message-input');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    input.value = text.substring(0, start) + char + text.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + char.length;
}

// --- OUTGOING COMMUNICATION DISPATCH ---

async function sendChatMessage(event) {
    event.preventDefault();
    if (!currentChat.chatId || !stompClient || !stompClient.connected) {
        alert('Please connect to an active channel or verify network status.');
        return;
    }

    const input = document.getElementById('message-input');
    const content = input.value.trim();

    // Requires message string OR an embedded staged file payload
    if (content === '' && !stagedFile) return;

    let fileUrl = null;
    let fileName = null;

    // Execute sequential document upload phase prior to broadcasting frame
    if (stagedFile) {
        const formData = new FormData();
        formData.append('file', stagedFile);

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });
            if (response.ok) {
                const uploadResult = await response.json();
                fileUrl = uploadResult.fileUrl;
                fileName = uploadResult.fileName;
            } else {
                throw new Error('File transfer server rejection');
            }
        } catch (err) {
            console.error(err);
            alert('File attachment transfer failed.');
            return;
        }

        // Wipe stage preview
        clearStagedFile();
    }

    const chatMessage = {
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        senderAvatar: currentUser.avatarUrl,
        recipientId: currentChat.type === 'DIRECT' ? currentChat.id : null,
        chatId: currentChat.chatId,
        content: content,
        type: 'CHAT',
        fileUrl: fileUrl,
        fileName: fileName
    };

    // Push STOMP communication message mapping frame directly to targeted channel API endpoint
    stompClient.send(`/app/chat/${currentChat.chatId}/sendMessage`, {}, JSON.stringify(chatMessage));

    // Reset localized interface trigger controls
    input.value = '';
}

// --- TELEMETRY: TYPING INDICATORS ---

function handleTypingEvent() {
    if (!currentChat.chatId || !stompClient || !stompClient.connected) return;

    const typingPayload = {
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        chatId: currentChat.chatId,
        type: 'TYPING'
    };

    stompClient.send(`/app/chat/${currentChat.chatId}/typing`, {}, JSON.stringify(typingPayload));
}

function displayTypingNotice(username) {
    const bar = document.getElementById('typing-indicator');
    bar.querySelector('span').innerText = `${username} is typing...`;
    bar.classList.add('active');

    // Debounce decay cycle
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        bar.classList.remove('active');
    }, 2000);
}

// --- WORKSPACE DIALOG CONTROLS ---

function openCreateRoomModal() {
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('create-room-modal').classList.remove('hidden');
    document.getElementById('room-name').focus();
}

function closeCreateRoomModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('create-room-modal').classList.add('hidden');
    document.getElementById('room-name').value = '';
}

async function submitCreateRoom(event) {
    event.preventDefault();
    const nameInput = document.getElementById('room-name');
    const name = nameInput.value.trim().replace(/\s+/g, '-');

    if (name === '') return;

    try {
        const response = await fetch('/api/chats/rooms', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            const newRoom = await response.json();
            closeCreateRoomModal();
            loadChannels();
            selectChatTarget('ROOM', newRoom.id, newRoom.name);
        }
    } catch (err) {
        console.error('Failed to construct channel', err);
    }
}

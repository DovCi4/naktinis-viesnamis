let currentUser = null;
let currentTopicId = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function startLoader() {
  const duration = 5000;
  const startedAt = performance.now();

  function update(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const percentage = Math.floor(progress * 100);

    $("#progressBar").style.width = `${percentage}%`;
    $("#progressText").textContent = `${percentage}%`;

    if (progress < 1) {
      requestAnimationFrame(update);
      return;
    }

    $("#loader").classList.add("fade");
    $("#app").classList.remove("hidden");
    document.body.classList.remove("loading");

    setTimeout(() => {
      $("#loader")?.remove();
    }, 700);
  }

  requestAnimationFrame(update);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Įvyko klaida.");
  }

  return data;
}

function setLogo(url) {
  for (const selector of ["#headerLogo", "#loaderLogo"]) {
    const element = $(selector);

    if (!element) continue;

    if (url) {
      element.innerHTML = `
        <img
          src="${url}?v=${Date.now()}"
          alt="Naktinis Viešnamis logotipas"
        >
      `;
      element.classList.add("has-image");
    } else {
      element.textContent = "NV";
      element.classList.remove("has-image");
    }
  }
}

async function loadSettings() {
  const settings = await api("/api/settings");
  setLogo(settings.logo);
}

async function loadMe() {
  const data = await api("/api/me");
  currentUser = data.user;
  updateUserInterface();
}

function updateUserInterface() {
  if (currentUser) {
    $("#guestActions").classList.add("hidden");
    $("#userActions").classList.remove("hidden");
    $("#welcomeUser").textContent = `Sveikas, ${currentUser.username}`;

    if (currentUser.role === "admin") {
      $("#adminButton").classList.remove("hidden");
    } else {
      $("#adminButton").classList.add("hidden");
    }
  } else {
    $("#guestActions").classList.remove("hidden");
    $("#userActions").classList.add("hidden");
    $("#adminButton").classList.add("hidden");
  }
}

async function loadTopics() {
  const topics = await api("/api/topics");

  if (!topics.length) {
    $("#topicList").innerHTML = `
      <div class="empty-state">
        Temų dar nėra. Sukurk pirmąją!
      </div>
    `;
    return;
  }

  $("#topicList").innerHTML = topics.map(topic => `
    <button class="topic-card" data-topic-id="${topic.id}">
      <div class="topic-avatar">
        ${escapeHtml(topic.author.slice(0, 2).toUpperCase())}
      </div>

      <div class="topic-main">
        <span class="topic-category">${escapeHtml(topic.category)}</span>
        <h3>${escapeHtml(topic.title)}</h3>
        <p>${escapeHtml(topic.content.slice(0, 120))}</p>

        <div class="topic-meta">
          <span>${escapeHtml(topic.author)}</span>
          <span>${formatDate(topic.createdAt)}</span>
        </div>
      </div>

      <div class="topic-comments">
        <strong>${topic.commentsCount}</strong>
        <span>komentarai</span>
      </div>
    </button>
  `).join("");

  $$(".topic-card").forEach(button => {
    button.addEventListener("click", () => {
      openTopic(button.dataset.topicId);
    });
  });
}

function openModal(id) {
  $(`#${id}`).classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.add("hidden");

  if (![...$$(".modal")].some(item => !item.classList.contains("hidden"))) {
    document.body.classList.remove("modal-open");
  }

  modal.querySelectorAll(".message").forEach(message => {
    message.textContent = "";
    message.className = "message";
  });
}

async function openTopic(id) {
  const topic = await api(`/api/topics/${id}`);
  currentTopicId = topic.id;

  const commentsHtml = topic.comments.length
    ? topic.comments.map(comment => `
        <article class="comment">
          <div class="comment-avatar">
            ${escapeHtml(comment.author.slice(0, 2).toUpperCase())}
          </div>

          <div>
            <div class="comment-head">
              <b>${escapeHtml(comment.author)}</b>
              <span>${formatDate(comment.createdAt)}</span>
            </div>

            <p>${escapeHtml(comment.content)}</p>
          </div>
        </article>
      `).join("")
    : `<p class="no-comments">Komentarų dar nėra.</p>`;

  $("#topicViewContent").innerHTML = `
    <span class="topic-category">${escapeHtml(topic.category)}</span>
    <h2>${escapeHtml(topic.title)}</h2>

    <div class="topic-author">
      ${escapeHtml(topic.author)} · ${formatDate(topic.createdAt)}
    </div>

    <div class="topic-content-text">
      ${escapeHtml(topic.content)}
    </div>

    <h3 class="comments-title">
      Komentarai (${topic.comments.length})
    </h3>

    <div class="comments-list">
      ${commentsHtml}
    </div>
  `;

  if (currentUser) {
    $("#commentForm").classList.remove("hidden");
  } else {
    $("#commentForm").classList.add("hidden");
  }

  openModal("topicViewModal");
}

async function handleAuth(form, endpoint) {
  const formData = new FormData(form);
  const message = form.querySelector(".message");

  message.textContent = "Prašome palaukti...";

  try {
    const data = await api(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });

    currentUser = data.user;
    updateUserInterface();

    message.textContent = "Sėkmingai!";
    message.classList.add("success");

    setTimeout(() => {
      closeModal(form.closest(".modal"));
      form.reset();
    }, 500);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
}

$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  handleAuth(event.currentTarget, "/api/login");
});

$("#registerForm").addEventListener("submit", event => {
  event.preventDefault();
  handleAuth(event.currentTarget, "/api/register");
});

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/logout", {
    method: "POST"
  });

  currentUser = null;
  updateUserInterface();
});

$("#createTopicButton").addEventListener("click", () => {
  if (!currentUser) {
    openModal("loginModal");
    return;
  }

  openModal("topicModal");
});

$("#topicForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const message = form.querySelector(".message");

  try {
    await api("/api/topics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: formData.get("title"),
        category: formData.get("category"),
        content: formData.get("content")
      })
    });

    message.textContent = "Tema sukurta!";
    message.classList.add("success");

    await loadTopics();

    setTimeout(() => {
      closeModal(form.closest(".modal"));
      form.reset();
    }, 500);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});

$("#commentForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const message = form.querySelector(".message");

  try {
    await api(`/api/topics/${currentTopicId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: formData.get("content")
      })
    });

    form.reset();
    message.textContent = "Komentaras paskelbtas!";
    message.classList.add("success");

    await openTopic(currentTopicId);
    await loadTopics();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});

$("#logoForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const message = form.querySelector(".message");

  message.textContent = "Įkeliamas logotipas...";

  try {
    const response = await fetch("/api/admin/logo", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nepavyko įkelti logotipo.");
    }

    setLogo(data.logo);

    message.textContent = "GIF logotipas įkeltas!";
    message.classList.add("success");

    setTimeout(() => {
      closeModal(form.closest(".modal"));
      form.reset();
    }, 600);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});

$$("[data-open]").forEach(button => {
  button.addEventListener("click", () => {
    openModal(button.dataset.open);
  });
});

$$("[data-close]").forEach(element => {
  element.addEventListener("click", () => {
    closeModal(element.closest(".modal"));
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  const openedModal = [...$$(".modal")]
    .find(modal => !modal.classList.contains("hidden"));

  if (openedModal) {
    closeModal(openedModal);
  }
});

async function initialize() {
  try {
    await Promise.all([
      loadSettings(),
      loadMe(),
      loadTopics()
    ]);
  } catch (error) {
    console.error(error);
  }

  startLoader();
}

initialize();

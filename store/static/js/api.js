const API = {
	getCSRFToken() {
		const cookies = document.cookie.split(";");
		for (let cookie of cookies) {
			cookie = cookie.trim();
			if (cookie.startsWith("csrftoken=")) {
				return decodeURIComponent(cookie.substring(10));
			}
		}
		return null;
	},

	getHeaders(extraHeaders = {}) {
		return {
			"X-CSRFToken": this.getCSRFToken(),
			...extraHeaders,
		};
	},

	purchaseGame(gameId) {
		return fetch(`/api/purchase/${gameId}/`, {
			method: "POST",
			headers: this.getHeaders(),
		}).then((r) => {
			if (!r.ok) {
				return r.json().then((err) => {
					throw new Error(err.status || "Purchase failed");
				});
			}
			return r.json();
		});
	},

	toggleWishlist(gameId) {
		return fetch(`/api/wishlist/${gameId}/`, {
			method: "POST",
			headers: this.getHeaders(),
		}).then((r) => r.json());
	},

	toggleFollow(developerId) {
		return fetch(`/api/follow/${developerId}/`, {
			method: "POST",
			headers: this.getHeaders(),
		}).then((r) => r.json());
	},

	submitReview(gameId, rating, comment) {
		return fetch(`/api/review/${gameId}/`, {
			method: "POST",
			headers: this.getHeaders({ "Content-Type": "application/json" }),
			body: JSON.stringify({ rating, comment }),
		}).then((r) => r.json());
	},

	fetchFilteredGames(baseUrl, search, genre, maxPrice) {
		const url = `${baseUrl}?search=${encodeURIComponent(search)}&genre=${encodeURIComponent(genre)}&max_price=${maxPrice}&format=json`;
		return fetch(url, {
			headers: { "X-Requested-With": "XMLHttpRequest" },
		}).then((res) => {
			if (!res.ok) throw new Error("Errore durante il filtraggio dei giochi");
			return res.json();
		});
	},
};

const DOMManager = {
	updatePurchaseUI(button, gameId) {
		const actionsContainer = button.closest(".actions");
		showNotification("Game purchased successfully!");

		if (actionsContainer) {
			actionsContainer.querySelector('button[onclick*="toggleWishlist"]')?.remove();
			actionsContainer.querySelector('button[onclick*="purchaseGame"]')?.remove();
		}

		const p = document.createElement("p");
		p.className = "owned-badge";
		p.textContent = "✓ You own this game";
		actionsContainer?.prepend(p);

		if (!document.querySelector(".reviews-section")) {
			const mainContainer = document.querySelector("main");
			const reviewsSection = document.createElement("div");
			reviewsSection.className = "reviews-section";
			reviewsSection.innerHTML = `
				<h2>Reviews</h2>
				<div class="review-form-container">
					<h3>Leave a Review</h3>
					<form id="review-form" data-game-id="${gameId}">
						<div class="form-group">
							<label for="rating">Rating</label>
							<select id="rating" required>
								<option value="">Select rating...</option>
								<option value="5">5 - Excellent</option>
								<option value="4">4 - Good</option>
								<option value="3">3 - Average</option>
								<option value="2">2 - Poor</option>
								<option value="1">1 - Terrible</option>
							</select>
						</div>
						<div class="form-group">
							<label for="comment">Comment</label>
							<textarea id="comment" rows="5" placeholder="Share your thoughts..."></textarea>
						</div>
						<button type="submit">Submit Review</button>
					</form>
				</div>
				<div class="reviews-list">
					<p>No reviews yet. Be the first to review!</p>
				</div>
			`;
			mainContainer?.appendChild(reviewsSection);
		}
	},

	updateWishlistUI(button, status) {
		if (status === "added") {
			showNotification("Added to wishlist");
			button.textContent = "Remove from Wishlist";
			button.setAttribute("data-wishlisted", "true");
		} else if (status === "removed") {
			showNotification("Removed from wishlist");
			button.textContent = "Add to Wishlist";
			button.removeAttribute("data-wishlisted");

			const listItem = button.closest("li");
			if (listItem) {
				listItem.remove();
				const list = document.querySelector(".game-list");
				if (list && !list.querySelector("li")) {
					list.outerHTML =
						'<p>Your wishlist is empty. <a href="/catalog/">Browse the store</a></p>';
				}
			}
		}
	},

	updateFollowUI(button, status) {
		if (status === "followed") {
			showNotification("Following developer");
			button.textContent = "Following";
			button.setAttribute("data-following", "true");
		} else if (status === "unfollowed") {
			showNotification("Unfollowed developer");
			button.textContent = "Follow Developer";
			button.removeAttribute("data-following");
		}
	},

	insertNewReview(reviewData) {
		const container = document.querySelector(".reviews-list");
		if (!container) return;

		container.querySelector(`[data-review-id="${reviewData.id}"]`)?.remove();
		container.querySelector("p")?.remove();

		const article = document.createElement("article");
		article.className = "review-item";
		article.setAttribute("data-review-id", reviewData.id);
		article.innerHTML = `
			<div class="review-header">
				<strong>${reviewData.player_username}</strong>
				<span class="review-rating">★ ${reviewData.rating}/5</span>
				<small>${reviewData.created_at}</small>
			</div>
			<p>${reviewData.comment}</p>
		`;
		container.prepend(article);

		this.updateAverageRating();
	},

	updateAverageRating() {
		const container = document.querySelector(".reviews-list");
		const reviewItems = container.querySelectorAll(".review-item");
		const reviewCount = reviewItems.length;

		let ratingDisplay = document.querySelector(".game-meta .rating");
		if (!ratingDisplay) {
			ratingDisplay = document.createElement("div");
			ratingDisplay.className = "rating";
			document.querySelector(".game-meta")?.appendChild(ratingDisplay);
		}

		if (reviewCount > 0) {
			const totalRating = Array.from(reviewItems).reduce((sum, item) => {
				const text = item.querySelector(".review-rating").textContent;
				const score = parseInt(text.match(/\d+/)[0], 10);
				return sum + score;
			}, 0);

			const avgRating = totalRating / reviewCount;

			ratingDisplay.innerHTML = `
				<strong>${avgRating.toFixed(1)}/5</strong>
				<span>(${reviewCount} review${reviewCount !== 1 ? "s" : ""})</span>
			`;
		}
	},

	generateGameHTML(game) {
		const imgHTML = game.cover_image_url
			? `<img src="${game.cover_image_url}" alt="${game.title}">`
			: `<p>No Image Available</p>`;
		const priceHTML = game.price === 0 ? "Free To Play" : `&euro;${game.price.toFixed(2)}`;
		const genresHTML = game.genres.map((genre) => `<span>${genre}</span>`).join("");

		return `
			${imgHTML}
			<h3><a href="/game/${game.id}/">${game.title}</a></h3>
			<p class="price">${priceHTML}</p>
			<p class="genres">${genresHTML}</p>
			<footer>
				<small>by ${game.developer_username}</small>
				<a href="/game/${game.id}/">View</a>
			</footer>
		`;
	},

	updateGameCatalogUI(games, followedGames, searchForm) {
		const mainList = document.getElementById("main-game-list");
		const followedList = document.getElementById("followed-game-list");
		const followedContainer = document.getElementById("followed-devs-container");

		if (followedContainer && followedList) {
			if (!followedGames || followedGames.length === 0) {
				followedContainer.style.display = "none";
			} else {
				followedContainer.style.display = "block";
				followedList.innerHTML = "";
				followedGames.forEach((game) => {
					const li = document.createElement("li");
					li.innerHTML = this.generateGameHTML(game);
					followedList.appendChild(li);
				});
			}
		}

		let emptyMsg = document.getElementById("no-games-msg");
		if (games.length === 0) {
			if (mainList) mainList.style.display = "none";
			if (!emptyMsg) {
				emptyMsg = document.createElement("p");
				emptyMsg.id = "no-games-msg";
				emptyMsg.textContent = "No games found. Try adjusting your filters.";
				searchForm.insertAdjacentElement("afterend", emptyMsg);
			}
		} else {
			if (emptyMsg) emptyMsg.remove();
			if (mainList) {
				mainList.style.display = "grid";
				mainList.innerHTML = "";
				games.forEach((game) => {
					const li = document.createElement("li");
					li.innerHTML = this.generateGameHTML(game);
					mainList.appendChild(li);
				});
			}
		}
	},
};

window.purchaseGame = function (button, gameId) {
	API.purchaseGame(gameId)
		.then(() => DOMManager.updatePurchaseUI(button, gameId))
		.catch((error) => showNotification(error.message || "Network error", "error"));
};

window.toggleWishlist = function (button, gameId) {
	API.toggleWishlist(gameId)
		.then((data) => DOMManager.updateWishlistUI(button, data.status))
		.catch(() => showNotification("Network error", "error"));
};

window.toggleFollow = function (button, developerId) {
	API.toggleFollow(developerId)
		.then((data) => DOMManager.updateFollowUI(button, data.status))
		.catch(() => showNotification("Network error", "error"));
};

document.addEventListener("submit", (e) => {
	if (e.target?.id === "review-form") {
		e.preventDefault();

		const form = e.target;
		const gameId = form.dataset.gameId;
		const rating = document.getElementById("rating").value;
		const comment = document.getElementById("comment").value;

		API.submitReview(gameId, rating, comment)
			.then((data) => {
				document.getElementById("rating").value = "";
				document.getElementById("comment").value = "";
				showNotification("Review submitted successfully!");

				if (data.review) {
					DOMManager.insertNewReview(data.review);
				}
			})
			.catch(() => showNotification("Network error", "error"));
	}
});

document.addEventListener("DOMContentLoaded", () => {
	const searchForm = document.querySelector(".subnav-search-form");
	if (!searchForm) return;

	const searchInput = searchForm.querySelector('input[name="search"]');
	const genreSelect = searchForm.querySelector('select[name="genre"]');
	const priceSlider = searchForm.querySelector('input[name="max_price"]');
	const priceDisplay = document.getElementById("price-display");
	let debounceTimer;

	function syncPriceLabel() {
		if (!priceSlider || !priceDisplay) return;
		const val = parseInt(priceSlider.value, 10);
		if (val >= 60) {
			priceDisplay.textContent = "No limit";
		} else if (val === 0) {
			priceDisplay.textContent = "Free To Play";
		} else {
			priceDisplay.textContent = `€${val}`;
		}
	}

	function handleFiltering() {
		const searchQuery = searchInput ? searchInput.value : "";
		const selectedGenre = genreSelect ? genreSelect.value : "";
		let maxPriceVal = priceSlider ? priceSlider.value : "";

		if (parseInt(maxPriceVal, 10) >= 60) maxPriceVal = "";

		const baseUrl = searchForm.getAttribute("action") || window.location.pathname;

		API.fetchFilteredGames(baseUrl, searchQuery, selectedGenre, maxPriceVal)
			.then((data) => {
				DOMManager.updateGameCatalogUI(data.games, data.followed_games, searchForm);
			})
			.catch((err) => console.error(err));
	}

	syncPriceLabel();

	if (genreSelect) {
		genreSelect.addEventListener("change", handleFiltering);
	}

	if (priceSlider) {
		priceSlider.addEventListener("input", () => {
			syncPriceLabel();
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(handleFiltering, 250);
		});
	}

	if (searchInput) {
		searchInput.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(handleFiltering, 300);
		});
	}
});

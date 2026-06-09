function getCSRFToken() {
	const cookies = document.cookie.split(";");
	for (let cookie of cookies) {
		cookie = cookie.trim();
		if (cookie.startsWith("csrftoken=")) {
			return decodeURIComponent(cookie.substring(10));
		}
	}
	return null;
}

function purchaseGame(button, gameId) {
	const actionsContainer = button.closest(".actions");

	fetch(`/api/purchase/${gameId}/`, {
		method: "POST",
		headers: { "X-CSRFToken": getCSRFToken() },
	})
		.then((r) => {
			if (!r.ok) {
				return r.json().then((err) => {
					throw new Error(err.status || "Purchase failed");
				});
			}
			return r.json();
		})
		.then((data) => {
			showNotification("Game purchased successfully!");

			if (actionsContainer) {
				actionsContainer.querySelector('button[onclick*="toggleWishlist"]')?.remove();
				actionsContainer.querySelector('button[onclick*="purchaseGame"]')?.remove();
			}

			const p = document.createElement("p");
			p.className = "owned-badge";
			p.textContent = "✓ You own this game";
			actionsContainer.prepend(p);

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
				mainContainer.appendChild(reviewsSection);
			}
		})
		.catch((error) => {
			showNotification(error.message || "Network error", "error");
		});
}

function toggleWishlist(button, gameId) {
	fetch(`/api/wishlist/${gameId}/`, {
		method: "POST",
		headers: { "X-CSRFToken": getCSRFToken() },
	})
		.then((r) => r.json())
		.then((data) => {
			if (data.status === "added") {
				showNotification("Added to wishlist");
				button.setAttribute("data-wishlisted", "true");
			} else if (data.status === "removed") {
				showNotification("Removed from wishlist");
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
		})
		.catch(() => showNotification("Network error", "error"));
}

function toggleFollow(button, developerId) {
	fetch(`/api/follow/${developerId}/`, {
		method: "POST",
		headers: { "X-CSRFToken": getCSRFToken() },
	})
		.then((r) => r.json())
		.then((data) => {
			if (data.status === "followed") {
				showNotification("Following developer");
				button.textContent = "Following";
				button.setAttribute("data-following", "true");
			} else if (data.status === "unfollowed") {
				showNotification("Unfollowed developer");
				button.textContent = "Follow Developer";
				button.removeAttribute("data-following");
			}
		})
		.catch(() => showNotification("Network error", "error"));
}

document.addEventListener("submit", (e) => {
	if (e.target?.id === "review-form") {
		e.preventDefault();

		const form = e.target;
		const gameId = form.dataset.gameId;
		const rating = document.getElementById("rating").value;
		const comment = document.getElementById("comment").value;

		fetch(`/api/review/${gameId}/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-CSRFToken": getCSRFToken(),
			},
			body: JSON.stringify({ rating, comment }),
		})
			.then((r) => r.json())
			.then((data) => {
				document.getElementById("rating").value = "";
				document.getElementById("comment").value = "";
				showNotification("Review submitted successfully!");

				if (data.review) {
					const container = document.querySelector(".reviews-list");
					if (container) {
						container.querySelector(`[data-review-id="${data.review.id}"]`)?.remove();
						container.querySelector("p")?.remove();

						const article = document.createElement("article");
						article.className = "review-item";
						article.setAttribute("data-review-id", data.review.id);
						article.innerHTML = `
							<div class="review-header">
								<strong>${data.review.player_username}</strong>
								<span class="review-rating">★ ${data.review.rating}/5</span>
								<small>${data.review.created_at}</small>
							</div>
							<p>${data.review.comment}</p>
						`;
						container.prepend(article);

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
					}
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

	syncPriceLabel();

	function fetchFilteredGames() {
		const searchQuery = searchInput ? searchInput.value : "";
		const selectedGenre = genreSelect ? genreSelect.value : "";

		let maxPriceVal = priceSlider ? priceSlider.value : "";
		if (parseInt(maxPriceVal, 10) >= 60) {
			maxPriceVal = "";
		}

		const baseUrl = searchForm.getAttribute("action") || window.location.pathname;
		const url = `${baseUrl}?search=${encodeURIComponent(searchQuery)}&genre=${encodeURIComponent(selectedGenre)}&max_price=${maxPriceVal}&format=json`;

		fetch(url, {
			headers: { "X-Requested-With": "XMLHttpRequest" },
		})
			.then((res) => {
				if (!res.ok) throw new Error("Errore durante il filtraggio dei giochi");
				return res.json();
			})
			.then((data) => {
				updateGameCatalogUI(data.games);
			})
			.catch((err) => {
				console.error(err);
			});
	}

	function updateGameCatalogUI(games) {
		let listElement = document.querySelector(".game-list");

		if (games.length === 0) {
			if (listElement) listElement.remove();

			let emptyMsg = document.getElementById("no-games-msg");
			if (!emptyMsg) {
				emptyMsg = document.createElement("p");
				emptyMsg.id = "no-games-msg";
				emptyMsg.textContent = "No games found. Try adjusting your filters.";
				searchForm.insertAdjacentElement("afterend", emptyMsg);
			}
			return;
		}

		document.getElementById("no-games-msg")?.remove();

		if (!listElement) {
			listElement = document.createElement("ul");
			listElement.className = "game-list";
			searchForm.insertAdjacentElement("afterend", listElement);
		} else {
			listElement.innerHTML = "";
		}

		games.forEach((game) => {
			const li = document.createElement("li");

			const imgHTML = game.cover_image_url
				? `<img src="${game.cover_image_url}" alt="${game.title}">`
				: `<p>No Image Available</p>`;

			const priceHTML = game.price === 0 ? "Free To Play" : `&euro;${game.price.toFixed(2)}`;

			const genresHTML = game.genres.map((genre) => `<span>${genre}</span>`).join("");

			li.innerHTML = `
                ${imgHTML}
                <h3><a href="/game/${game.id}/">${game.title}</a></h3>
                <p class="price">${priceHTML}</p>
                <p class="genres">${genresHTML}</p>
                <footer>
                    <small>by ${game.developer_username}</small>
                    <a href="/game/${game.id}/">View</a>
                </footer>
            `;
			listElement.appendChild(li);
		});
	}

	if (genreSelect) {
		genreSelect.addEventListener("change", fetchFilteredGames);
	}

	if (priceSlider) {
		priceSlider.addEventListener("input", () => {
			syncPriceLabel();
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(fetchFilteredGames, 250);
		});
	}

	if (searchInput) {
		searchInput.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(fetchFilteredGames, 300);
		});
	}
});

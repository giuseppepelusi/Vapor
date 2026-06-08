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
				button.textContent = "Remove from Wishlist";
				button.setAttribute("data-wishlisted", "true");
			} else if (data.status === "removed") {
				showNotification("Removed from wishlist");
				button.textContent = "Add to Wishlist";
				button.removeAttribute("data-wishlisted");

				const article = button.closest("article");
				if (article) {
					article.remove();
					const section = document.querySelector("section");
					if (section && !section.querySelector("article")) {
						section.innerHTML = "<h1>My Wishlist</h1><p>Your wishlist is empty.</p>";
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
					const container = document.querySelector("aside > div");
					if (container) {
						container.querySelector(`[data-review-id="${data.review.id}"]`)?.remove();
						container.querySelector("p")?.remove();

						const article = document.createElement("article");
						article.setAttribute("data-review-id", data.review.id);
						article.innerHTML = `
							<header>
								<strong>${data.review.player_username}</strong>
								<span>Rating: ${data.review.rating}/5</span>
							</header>
							<p>${data.review.comment}</p>
							<footer>
								<small>${data.review.created_at}</small>
							</footer>
						`;
						container.prepend(article);

						const reviewCount = container.querySelectorAll("article").length;
						const ratingDisplay = document.getElementById("rating-display");
						if (ratingDisplay && reviewCount > 0) {
							const avgRating =
								[...container.querySelectorAll("article")].reduce((sum, r) => {
									return sum + parseInt(r.querySelector("header span").textContent.match(/\d+/)[0]);
								}, 0) / reviewCount;
							ratingDisplay.textContent = `Rating: ${avgRating.toFixed(1)}/5 (${reviewCount} review${reviewCount !== 1 ? "s" : ""})`;
						}
					}
				}
			})
			.catch(() => showNotification("Network error", "error"));
	}
});

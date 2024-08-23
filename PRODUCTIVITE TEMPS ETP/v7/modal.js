// Récupération des éléments du DOM
const modal = document.getElementById("infoModal");
const btn = document.getElementById("infoButton");
const span = document.getElementsByClassName("close")[0];

// Fonction pour s'assurer que MathJax a rendu les formules
function ensureMathJaxRendered(callback) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([document.querySelector('.modal-content')])
            .then(() => {
                if (callback) callback();
            })
            .catch((err) => console.log('MathJax error:', err));
    } else {
        console.log('MathJax not loaded');
        if (callback) callback();
    }
}

// Ouverture de la fenêtre modale au clic sur le bouton
btn.onclick = function() {
    modal.style.display = "block";
    ensureMathJaxRendered();
}

// Fermeture de la fenêtre modale au clic sur le (x)
span.onclick = function() {
    modal.style.display = "none";
}

// Fermeture de la fenêtre modale au clic en dehors de celle-ci
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
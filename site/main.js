document.querySelectorAll('a[href="#features"]').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.getElementById("features");
        if (target) {
            const yOffset = -128;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    });
});
// Pantalla de selección de tipo de documento
document.addEventListener('DOMContentLoaded', () => {
    const pdfNacionOption = document.getElementById('pdfNacionOption');
    
    // Evento para seleccionar PDF NACION
    pdfNacionOption.addEventListener('click', () => {
        // Redirigir al dashboard de procesamiento
        window.location.href = 'dashboard.html';
    });
    
    // También el botón dentro de la tarjeta
    const pdfNacionBtn = pdfNacionOption.querySelector('.option-btn');
    pdfNacionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = 'dashboard.html';
    });

    const pdfPerfilOption = document.getElementById('pdfPerfilOption');
    
    // Evento para seleccionar PDF PERFIL
    pdfPerfilOption.addEventListener('click', () => {
        // Redirigir al dashboard de procesamiento de PERFIL
        window.location.href = 'dashboard-perfil.html';
    });
    
    // También el botón dentro de la tarjeta
    const pdfPerfilBtn = pdfPerfilOption.querySelector('.option-btn');
    pdfPerfilBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = 'dashboard-perfil.html';
    });
});


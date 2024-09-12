const { Plugin, Modal, Notice, requestUrl } = require('obsidian');

// Clase para el Modal que mostrará el README
class ReadmeModal extends Modal {
  constructor(app, readmeContent) {
    super(app);
    this.readmeContent = readmeContent;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.empty();

    // Crear un botón para copiar el contenido al portapapeles
    const copyButton = contentEl.createEl('button', { text: 'Copiar al portapapeles' });
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(this.readmeContent).then(() => {
        new Notice('Contenido copiado al portapapeles.');
      }).catch(err => {
        new Notice('Error al copiar al portapapeles.');
        console.error(err);
      });
    });

    // Mostrar el contenido del README en el modal
    const readmeEl = contentEl.createEl('pre', { text: this.readmeContent });
    readmeEl.style.whiteSpace = 'pre-wrap';  // Para que el texto sea legible
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Plugin principal
module.exports = class GitHubShowPlugin extends Plugin {
  
  onload() {
    // Registra el evento `url-menu` que detecta clic derecho sobre URLs
    this.registerEvent(
      this.app.workspace.on('url-menu', (menu, url, source) => {
        const isGithubUrl = url.includes('github.com');

        if (isGithubUrl) {
          // Agrega una opción al menú contextual para mostrar el README
          menu.addItem((item) => {
            item.setTitle('Mostrar README')
              .setIcon('document')
              .onClick(() => {
                this.showReadme(url);
              });
          });
        }
      })
    );
  }

  async showReadme(githubUrl) {
    const repoPath = this.extractRepoPath(githubUrl);
    const readmeUrl = `https://api.github.com/repos/${repoPath}/readme`;

    try {
      // Realiza la petición HTTP a la API de GitHub
      const response = await requestUrl({
        url: readmeUrl,
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Decodifica el contenido del README (que está en base64)
      const readmeContent = atob(response.json.content);

      // Abre un modal para mostrar el README completo
      new ReadmeModal(this.app, readmeContent).open();
    } catch (error) {
      new Notice('Error al obtener el README.');
      console.error(error);
    }
  }

  extractRepoPath(githubUrl) {
    const regex = /github\.com\/([^\/]+\/[^\/]+)/;
    const match = githubUrl.match(regex);
    return match ? match[1] : '';
  }

  onunload() {
    console.log('GitHub Show Plugin unloaded');
  }
};

const { Plugin, Modal, Notice, requestUrl } = require("obsidian");

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
    const copyButton = contentEl.createEl("button", {
      text: "Copiar al portapapeles",
    });
    copyButton.addEventListener("click", () => {
      navigator.clipboard
        .writeText(this.readmeContent)
        .then(() => {
          new Notice("Contenido copiado al portapapeles.");
        })
        .catch((err) => {
          new Notice("Error al copiar al portapapeles.");
          console.error(err);
        });
    });

    // Mostrar el contenido del README en el modal
    const readmeEl = contentEl.createEl("pre", { text: this.readmeContent });
    readmeEl.style.whiteSpace = "pre-wrap"; // Para que el texto sea legible
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
      this.app.workspace.on("url-menu", (menu, url, source) => {
        const isGithubUrl = url.includes("github.com");

        if (isGithubUrl) {
          // Agrega una opción al menú contextual para mostrar el README
          menu.addItem((item) => {
            item
              .setTitle("Mostrar README")
              .setIcon("document")
              .onClick(() => {
                this.showReadme(url);
              });
          });

          // Agrega una opción al menú contextual para mostrar la estructura de archivos
          menu.addItem((item) => {
            item
              .setTitle("Mostrar Esquema de Archivos")
              .setIcon("folder")
              .onClick(() => {
                this.showRepoTree(url);
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
          Accept: "application/vnd.github.v3+json",
        },
      });

      // Decodifica el contenido del README (que está en base64)
      const readmeContent = atob(response.json.content);

      // Abre un modal para mostrar el README completo
      new ReadmeModal(this.app, readmeContent).open();
    } catch (error) {
      new Notice("Error al obtener el README.");
      console.error(error);
    }
  }

  // Función para obtener el contenido del directorio del repositorio
  async fetchRepoTree(repoPath) {
    const apiUrl = `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`; // `main` puede cambiar dependiendo de la rama principal
    try {
      const response = await requestUrl({
        url: apiUrl,
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (response.json && response.json.tree) {
        return response.json.tree;
      } else {
        throw new Error("No se pudo obtener la estructura del repositorio");
      }
    } catch (error) {
      new Notice("Error al obtener el esquema de archivos.");
      console.error(error);
    }
  }

  // Mostrar la estructura del repositorio en un modal
  async showRepoTree(githubUrl) {
    const repoPath = this.extractRepoPath(githubUrl);
    const repoTree = await this.fetchRepoTree(repoPath);

    if (repoTree) {
      const treeHtml = this.generateTreeHTML(repoTree);

      // Crea una instancia del modal
      const modal = new ReadmeModal(this.app, "");

      // Abre el modal
      modal.open();

      // Accede a `contentEl` correctamente desde la instancia del modal
      const { contentEl } = modal;

      // Limpia el contenido previo del modal
      contentEl.empty();

      // Crea un contenedor para el árbol de archivos
      const treeContainer = contentEl.createDiv();
      treeContainer.innerHTML = treeHtml;

      // Agregar botón de copiar al portapapeles
      const copyButton = contentEl.createEl("button", {
        text: "Copiar al portapapeles",
      });
      copyButton.addEventListener("click", () => {
        // Convierte el árbol de archivos a texto con formato
        const treeText = this.convertTreeToText(repoTree);

        navigator.clipboard
          .writeText(treeText)
          .then(() => {
            new Notice("Esquema de archivos copiado al portapapeles.");
          })
          .catch((err) => {
            new Notice("Error al copiar al portapapeles.");
            console.error(err);
          });
      });
    }
  }

  // Función para convertir el árbol de archivos en texto con formato correcto
  convertTreeToText(tree) {
    let result = "";

    // Función que procesa cada nodo del árbol y añade el nombre con la indentación correcta
    const processNode = (node, indentLevel) => {
      const indent = "\t".repeat(indentLevel) + '- '; // Añadir 2 espacios por nivel de indentación

      node.forEach((file) => {
        // Extrae solo el nombre del archivo o directorio
        const fileName = file.path.split("/").pop();
        result += `${indent}${fileName}${file.type === "tree" ? "/" : ""}\n`;

        // Si es un directorio, llama recursivamente para procesar su contenido
        if (file.type === "tree") {
          // Busca los archivos que están dentro del directorio actual
          const subFiles = tree.filter(
            (item) =>
              item.path.startsWith(`${file.path}/`) && item.path !== file.path
          );
          processNode(subFiles, indentLevel + 1); // Procesar los archivos dentro del directorio
        }
      });
    };

    // Filtra solo los archivos y carpetas que están en la raíz (sin slash '/')
    const rootFiles = tree.filter((file) => !file.path.includes("/"));

    processNode(rootFiles, 0); // Empezamos con el nivel de indentación 0
    return result;
  }

  extractRepoPath(githubUrl) {
    const regex = /github\.com\/([^\/]+\/[^\/]+)/;
    const match = githubUrl.match(regex);
    return match ? match[1] : "";
  }

  // Función para convertir la estructura del repositorio en un formato de lista HTML
  generateTreeHTML(tree) {
    const fileTree = {};

    // Construye un objeto jerárquico de los archivos y carpetas
    tree.forEach((file) => {
      const parts = file.path.split("/");
      let current = fileTree;

      parts.forEach((part, index) => {
        // Si estamos en el último elemento (archivo o directorio), lo agregamos
        if (index === parts.length - 1) {
          // Si es un directorio (tree), asegúrate de que sea un objeto
          if (file.type === "tree") {
            if (!current[part]) {
              current[part] = {}; // Directorio
            }
          } else {
            // Si es un archivo, solo almacénalo como cadena
            current[part] = file.type; // Archivo
          }
        } else {
          // Si el directorio aún no existe, lo inicializamos
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });

    // Función recursiva para convertir el objeto jerárquico en una lista HTML
    const renderTree = (node) => {
      let html = "<ul>";
      for (const key in node) {
        const type = node[key];
        html += `<li>${key}${typeof type === "object" ? "/" : ""}`;
        if (typeof type === "object") {
          html += renderTree(type);
        }
        html += "</li>";
      }
      html += "</ul>";
      return html;
    };

    return renderTree(fileTree);
  }

  onunload() {
    console.log("GitHub Show Plugin unloaded");
  }
};

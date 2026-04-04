type ExampleItem = {
  type: string;
  name: string;
  download_url?: string;
};

const EXAMPLES_API_URL =
  "https://api.github.com/repos/mimium-org/mimium-rs/contents/examples?ref=main";

export class ExampleSidebar {
  private readonly listEl: HTMLElement;
  private _open: boolean;

  constructor(
    private readonly rootEl: HTMLElement,
    private readonly onSelect: (source: string, filename: string) => void,
    initialOpen: boolean,
    private readonly backdropEl?: HTMLElement | null,
  ) {
    this.listEl = rootEl.querySelector(".sidebar-list") as HTMLElement;
    this._open = initialOpen;
    this.backdropEl?.addEventListener("click", () => this.close());
    this.applyState();
    void this.fetchList();
  }

  get isOpen(): boolean {
    return this._open;
  }

  toggle(): void {
    this._open ? this.close() : this.open();
  }

  open(): void {
    this._open = true;
    this.applyState();
  }

  close(): void {
    this._open = false;
    this.applyState();
  }

  private applyState(): void {
    this.rootEl.classList.toggle("sidebar--open", this._open);
    this.backdropEl?.classList.toggle("sidebar-backdrop--visible", this._open);
  }

  private async fetchList(): Promise<void> {
    this.listEl.innerHTML = '<p class="sidebar-msg">Loading…</p>';

    try {
      const res = await fetch(EXAMPLES_API_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        throw new Error(`GitHub API returned ${res.status}`);
      }

      const files = (await res.json()) as ExampleItem[];
      const examples = files
        .filter((f) => f.type === "file" && f.name.endsWith(".mmm"))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (examples.length === 0) {
        this.listEl.innerHTML = '<p class="sidebar-msg">No examples found.</p>';
        return;
      }

      this.listEl.innerHTML = "";
      for (const item of examples) {
        const btn = document.createElement("button");
        btn.className = "sidebar-item";
        btn.textContent = item.name.replace(/\.mmm$/, "");
        btn.title = item.name;
        btn.addEventListener("click", () => {
          void this.loadFile(btn, item);
        });
        this.listEl.appendChild(btn);
      }
    } catch (err) {
      this.listEl.innerHTML =
        '<p class="sidebar-msg sidebar-msg--error">Failed to load examples.<br>Check your connection.</p>';
      console.error("[sidebar]", err);
    }
  }

  private async loadFile(button: HTMLButtonElement, item: ExampleItem): Promise<void> {
    if (!item.download_url) {
      return;
    }

    this.listEl.querySelectorAll(".sidebar-item").forEach((el) => {
      el.classList.remove("sidebar-item--active");
    });

    button.classList.add("sidebar-item--active", "sidebar-item--loading");

    try {
      const res = await fetch(item.download_url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      this.onSelect(text, item.name);
      if (window.innerWidth < 768) {
        this.close();
      }
    } catch (err) {
      button.classList.remove("sidebar-item--active");
      console.error("[sidebar] load failed:", item.name, err);
    } finally {
      button.classList.remove("sidebar-item--loading");
    }
  }
}

export class Storage {
    constructor() {
        this.dbName = 'GolfSimDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('shots')) {
                    db.createObjectStore('shots', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveShot(shotData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shots'], 'readwrite');
            const store = transaction.objectStore('shots');
            const request = store.add({
                ...shotData,
                timestamp: new Date().toISOString()
            });

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllShots() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shots'], 'readonly');
            const store = transaction.objectStore('shots');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

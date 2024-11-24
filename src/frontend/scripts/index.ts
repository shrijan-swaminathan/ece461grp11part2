async function uploadModule(): Promise<void> {
    const form: HTMLFormElement | null = document.getElementById('uploadForm') as HTMLFormElement;
    const formData: FormData = new FormData(form);

    try {
        const response: Response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const result: { message: string } = await response.json();
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.innerHTML = `Upload status: ${result.message}`;
        }
    } catch (error) {
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.innerHTML = 'Upload failed. Please try again.';
        }
        console.error('Upload error:', error);
    }
}

async function searchModules(): Promise<void> {
    const searchTermElement: HTMLInputElement | null = document.getElementById('searchTerm') as HTMLInputElement;
    const searchTerm: string = searchTermElement.value;
    try {
        const response: Response = await fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`);
        const data: Array<{ moduleName: string; description: string }> = await response.json();
        
        const resultsDiv: HTMLElement | null = document.getElementById('results');
        if (resultsDiv) {
            if (data.length > 0) {
                resultsDiv.innerHTML = data.map(item => `
                    <div>
                        <h3>${item.moduleName}</h3>
                        <p>${item.description}</p>
                    </div>
                `).join('');
            } else {
                resultsDiv.innerHTML = '<p>No modules found.</p>';
            }
        }
    } catch (error) {
        const resultsDiv: HTMLElement | null = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = 'Search failed. Please try again.';
        }
        console.error('Search error:', error);
    }
}

async function getModuleRating(): Promise<void> {
    const rateModuleNameElement: HTMLInputElement | null = document.getElementById('rateModuleName') as HTMLInputElement;
    const moduleName: string = rateModuleNameElement.value;
    try {
        const response: Response = await fetch(`/api/rate?moduleName=${encodeURIComponent(moduleName)}`);
        const rating: { overall: number; dependencyScore: number; codeReviewScore: number } = await response.json();

        const ratingResultsElement: HTMLElement | null = document.getElementById('ratingResults');
        if (ratingResultsElement) {
            ratingResultsElement.innerHTML = `
                <p>Overall Rating: ${rating.overall}</p>
                <p>Dependency Score: ${rating.dependencyScore}</p>
                <p>Code Review Score: ${rating.codeReviewScore}</p>
            `;
        }
    } catch (error) {
        const ratingResultsElement: HTMLElement | null = document.getElementById('ratingResults');
        if (ratingResultsElement) {
            ratingResultsElement.innerHTML = 'Failed to retrieve rating. Please try again.';
        }
        console.error('Rating error:', error);
    }
}
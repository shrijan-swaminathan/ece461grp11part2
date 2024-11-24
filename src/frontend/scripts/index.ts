async function uploadModule(): Promise<void> {
    const form: HTMLFormElement | null = document.getElementById('uploadForm') as HTMLFormElement;
    const formData: FormData = new FormData(form);

    try {
        // get module name from form
        const moduleNameElement: HTMLInputElement | null = document.getElementById('moduleName') as HTMLInputElement;
        // get debloat checkbox from form
        const debloatElement: HTMLInputElement | null = document.getElementById('debloat') as HTMLInputElement;
        // get zip file from form
        const fileInput: HTMLInputElement | null = document.getElementById('moduleFile') as HTMLInputElement;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            throw new Error('No file selected');
        }
        // convert to base64 string
        const file = fileInput.files[0];
        const base64String = await readFileAsBase64(file);
        formData.append('moduleFile', base64String);
        const requestBody = {
            Content: base64String,
            debloat: debloatElement.checked,
            Name: moduleNameElement.value,
        };
        const response: Response = await fetch('https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
        const result: { message: string } = await response.json();
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.innerHTML = `Upload status: ${result.message}`;
        }
    } catch (error: any) {
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.innerHTML = error!.message || 'Upload failed. Please try again.';
        }
        console.error('Upload error:', error);
    }
}



function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error('Failed to read file as base64 string'));
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
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
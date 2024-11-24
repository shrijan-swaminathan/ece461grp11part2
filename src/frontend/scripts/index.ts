function toggleUploadMethod(): void {
    const uploadMethod: string = (document.querySelector('input[name="uploadMethod"]:checked') as HTMLInputElement).value;
    const fileInputSection: HTMLElement = document.getElementById('fileInputSection') as HTMLElement;
    const urlInputSection: HTMLElement = document.getElementById('urlInputSection') as HTMLElement;

    if (uploadMethod === 'file') {
        fileInputSection.classList.remove('hidden');
        urlInputSection.classList.add('hidden');
    } else {
        fileInputSection.classList.add('hidden');
        urlInputSection.classList.remove('hidden');
        removeFile();
    }
}

function removeFile(): void {
    const fileInput: HTMLInputElement = document.getElementById('moduleFile') as HTMLInputElement;
    fileInput.value = '';
    const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
    if (uploadResultElement) {
        uploadResultElement.innerHTML = '';
    }
}


async function uploadModule(): Promise<void> {
    const form: HTMLFormElement | null = document.getElementById('uploadForm') as HTMLFormElement;
    const formData: FormData = new FormData(form);

    try {
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }

        // Get module name from form
        const moduleNameElement: HTMLInputElement | null = document.getElementById('moduleName') as HTMLInputElement;
        const debloatElement: HTMLInputElement | null = document.getElementById('debloat') as HTMLInputElement;
        const fileInput: HTMLInputElement | null = document.getElementById('moduleFile') as HTMLInputElement;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            throw new Error('No file selected');
        }

        // Convert to base64 string
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

        const result = await response.json();
        if (response.status !== 201) {
            throw new Error(result);
        }

        // Successfully uploaded, show success message
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.style.color = 'green';
            uploadResultElement.innerHTML = `Successfully uploaded module. Metadata: ${JSON.stringify(result.metadata)}`;
        }
    } catch (error: any) {
        // Show error message
        const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
        if (uploadResultElement) {
            uploadResultElement.style.color = 'red';
            uploadResultElement.innerHTML = error!.message || 'Upload failed. Please try again.';
        }
        console.error('Upload error:', error);
    } finally {
        // Hide loading spinner once the process is complete
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
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
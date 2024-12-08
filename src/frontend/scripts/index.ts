function toggleUploadMethod(): void {
    const uploadMethod: string = (document.querySelector('input[name="uploadMethod"]:checked') as HTMLInputElement).value;
    const fileInputSection: HTMLElement = document.getElementById('fileInputSection') as HTMLElement;
    const urlInputSection: HTMLElement = document.getElementById('urlInputSection') as HTMLElement;

    if (uploadMethod === 'file') {
        fileInputSection.classList.remove('hidden');
        urlInputSection.classList.add('hidden');
        clearURLInput();
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
    const uploadMethod: string = (document.querySelector('input[name="uploadMethod"]:checked') as HTMLInputElement).value;
    const formData: FormData = new FormData();
    const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
    if (uploadResultElement) {
        uploadResultElement.innerHTML = '';
    }

    try {
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }

        const moduleNameElement: HTMLInputElement | null = document.getElementById('moduleName') as HTMLInputElement;
        const debloatElement: HTMLInputElement | null = document.getElementById('debloat') as HTMLInputElement;

        let requestBody: any;

        if (uploadMethod === 'file') {
            const fileInput: HTMLInputElement | null = document.getElementById('moduleFile') as HTMLInputElement;
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                throw new Error('No file selected');
            }

            // Convert file to base64
            const file = fileInput.files[0];
            const base64String = await readFileAsBase64(file);
            formData.append('moduleFile', base64String);

            requestBody = {
                Content: base64String,
                debloat: debloatElement.checked,
                Name: moduleNameElement.value,
            };
        } else if (uploadMethod === 'url') {
            const urlInputElement: HTMLInputElement | null = document.getElementById('npmPackageURL') as HTMLInputElement;
            if (!urlInputElement || !urlInputElement.value) {
                throw new Error('No URL provided');
            }

            requestBody = {
                URL: urlInputElement.value,
                debloat: debloatElement.checked,
                Name: moduleNameElement.value,
            };
        }

        const response: Response = await fetch('https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (response.status !== 201) {
            throw new Error(result);
        }

        // Successfully uploaded, show success message
        if (uploadResultElement) {
            uploadResultElement.style.color = 'green';
            uploadResultElement.innerHTML = `Successfully uploaded module. ID: ${result.metadata.ID as string}`;
        }
    } catch (error: any) {
        // Show error message
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


function clearURLInput() {
    const searchTermElement: HTMLInputElement | null = document.getElementById('npmPackageURL') as HTMLInputElement;
    searchTermElement.value = '';
}

async function downloadPackage() {
    try {
        let name = (document.getElementById('downloadModuleName') as HTMLInputElement).value;
        let version = (document.getElementById('downloadModuleVersion') as HTMLInputElement).value;
        // convert name to string
        name = name.toString();
        // convert version to string
        version = version.toString();;

        const reqbody = [{
            Name: name,
            Version: version
        }];
        // Get package ID using POST /packages
        const searchResponse: Response = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/packages`, {
            method: 'POST',
            body: JSON.stringify(reqbody)
        });

        if (!searchResponse.ok) throw new Error('Package not found');

        const packages = await searchResponse.json();
        console.log(packages);  // Debugging
        if (!packages.length) throw new Error('Package not found');

        // Get package content using GET /package/{id}
        const packageId = packages[0].ID;
        const contentResponse = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package/${packageId}`);
        
        if (!contentResponse.ok) throw new Error('Failed to download package');

        const blob = await contentResponse.blob();
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `${name}-${version}.zip`;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(downloadUrl);

        const downloadResult = document.getElementById('downloadResult');
        if (downloadResult) {
            downloadResult.innerHTML = 'Package downloaded successfully!';
            downloadResult.className = 'success-message';
        }
    } catch (error: any) {
        const downloadResult = document.getElementById('downloadResult');
        if (downloadResult) {
            downloadResult.innerHTML = `Download failed: ${error.message}`;
            downloadResult.className = 'error-message';
        }
        console.error('Download error:', error);
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
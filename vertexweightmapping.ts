public static _maxpoint(list: Array<BABYLON.Vector3>): BABYLON.Vector3 {
        let maxx = Math.max.apply(0, list.map(t => t.x));
        let maxy = Math.max.apply(0, list.map(t => t.y));
        let maxz = Math.max.apply(0, list.map(t => t.z));

        return new BABYLON.Vector3(maxx, maxy, maxz);
    }

    public static _minpoint(list: Array<BABYLON.Vector3>): BABYLON.Vector3 {
        let minx = Math.min.apply(0, list.map(t => t.x));
        let miny = Math.min.apply(0, list.map(t => t.y));
        let minz = Math.min.apply(0, list.map(t => t.z));

        return new BABYLON.Vector3(minx, miny, minz);
    }
    /*custom weight function*/
    public static weightfunc(bone: { name: string, index: number, parent: string, length: number, direction: BABYLON.Vector3, position: BABYLON.Vector3, metadata: any }, weight: number, distance: number, vertex: BABYLON.Vector3) {

        if (bone.name == "Neck")
            return weight * 5;

        if (bone.position.y < vertex.y)
            return weight;
        return 1;
    }

    public static computeWeights(vertexdata: BABYLON.FloatArray, bones: Array<{ name: string, index: number, parent: string, length: number, direction: BABYLON.Vector3, position: BABYLON.Vector3, metadata: any }>, diffratio: BABYLON.Vector3): { indexes: any, weights: any } {

        let targetpositions = new Array<BABYLON.Vector3>();

        for (let i = 0; i < (vertexdata.length / 3); i++)
            targetpositions.push(BABYLON.Vector3.FromArray(vertexdata, i * 3).multiply(diffratio));
        let targetmax = this._maxpoint(targetpositions);
        var size = targetmax.subtract(this._minpoint(targetpositions));


        bones.forEach(t => { t.position = new BABYLON.Vector3(t.position._x, t.position._y, t.position._z); t.direction = new BABYLON.Vector3(t.direction._x, t.direction._y, t.direction._z); });

        var maxdistance = size.x;
        if (size.y > maxdistance)
            maxdistance = size.y;
        if (size.z > maxdistance)
            maxdistance = size.z;

        /*customize bone weighting*/
        bones.find(t => t.name == "Head").metadata.weightfunc = this.weightfunc;
        bones.find(t => t.name == "Eyes").metadata.weightfunc = this.weightfunc;
        bones.find(t => t.name == "Neck").metadata.weightfunc = this.weightfunc;
        bones.find(t => t.name == "Eyebrows").metadata.weightfunc = this.weightfunc;


        let vertexweightmap = new Array<Array<{ boneindex: number, weight: number, distance: number }>>();
        for (let i = 0; i < targetpositions.length; i++) {
            let vertex = targetpositions[i];
            var boneweights = new Array<{ boneindex: number, weight: number, distance: number }>();
            bones.forEach(b => {

                let distance = 0;
                let weight: number;
                if (b.index == -1 || b.length == 0 || b.metadata.noweight == true)
                    weight = 0;
                else {
                    //normalize distance
                    distance = BABYLON.Vector3.Distance(vertex, b.position) / maxdistance;
                    let deviation = 0.07;

                    if (b.metadata.deviation != null)
                        deviation = b.metadata.deviation;

                    if (distance > 1.01)
                        throw "expected distance between 0 and 1, got: " + distance;


                    weight = 1 / Math.sqrt(2 * Math.PI * deviation * deviation) * Math.exp(- distance * distance / (2 * deviation * deviation));

                    if (vertex.multiply(b.direction).multiply(b.direction).length() - b.position.length() > 0)
                        weight = 0;

                    if (b.metadata.weightfunc != null)
                        weight = b.metadata.weightfunc(b, weight, distance, vertex);
                }
                boneweights.push({ boneindex: b.index, weight: weight, distance: distance });
            });
            vertexweightmap.push(boneweights);
        }

        let ind = [];
        let wd = [];
        for (let ti = 0; ti < targetpositions.length; ti++) {
            var vertexinfo = vertexweightmap[ti];

            vertexinfo = vertexinfo.filter(t => t.weight > 0).sort((a, b) => a.distance - b.distance).slice(0, 4);

            if (vertexinfo.length < 4)
                while (vertexinfo.length < 4)
                    vertexinfo.push({ boneindex: -1, weight: 0, distance: 0 });

            var totalweight = vertexinfo.map(t => t.weight).reduce((a, b) => a + b);

             
            var bw0 = vertexinfo[0].weight / totalweight;
            var bw1 = vertexinfo[1].weight / totalweight;
            var bw2 = vertexinfo[2].weight / totalweight;
            var bw3 = vertexinfo[3].weight / totalweight;



            let inx = ti * 4;
            ind[inx + 0] = vertexinfo[0].boneindex;
            ind[inx + 1] = vertexinfo[1].boneindex;
            ind[inx + 2] = vertexinfo[2].boneindex;
            ind[inx + 3] = vertexinfo[3].boneindex;

            wd[inx + 0] = bw0;
            wd[inx + 1] = bw1;
            wd[inx + 2] = bw2;
            wd[inx + 3] = bw3;
        }
        return { indexes: ind, weights: wd };
    }

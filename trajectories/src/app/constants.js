import { Vector3 } from 'three'

var planet_data = 
`mercury   0.38709927      0.20563593      7.00497902      252.25032350     77.45779628     48.33076593
          0.00000037      0.00001906     -0.00594749   149472.67411175      0.16047689     -0.12534081
venus     0.72333566      0.00677672      3.39467605      181.97909950    131.60246718     76.67984255
          0.00000390     -0.00004107     -0.00078890    58517.81538729      0.00268329     -0.27769418
earth   1.00000261      0.01671123     -0.00001531      100.46457166    102.93768193      0.0
          0.00000562     -0.00004392     -0.01294668    35999.37244981      0.32327364      0.0
mars      1.52371034      0.09339410      1.84969142       -4.55343205    -23.94362959     49.55953891
          0.00001847      0.00007882     -0.00813131    19140.30268499      0.44441088     -0.29257343
jupiter   5.20288700      0.04838624      1.30439695       34.39644051     14.72847983    100.47390909
         -0.00011607     -0.00013253     -0.00183714     3034.74612775      0.21252668      0.20469106
saturn    9.53667594      0.05386179      2.48599187       49.95424423     92.59887831    113.66242448
         -0.00125060     -0.00050991      0.00193609     1222.49362201     -0.41897216     -0.28867794
uranus   19.18916464      0.04725744      0.77263783      313.23810451    170.95427630     74.01692503
         -0.00196176     -0.00004397     -0.00242939      428.48202785      0.40805281      0.04240589
neptune  30.06992276      0.00859048      1.77004347      -55.12002969     44.96476227    131.78422574
          0.00026291      0.00005105      0.00035372      218.45945325     -0.32241464     -0.00508664`


var units = planet_data.split("\n").map(v=>v.replace(/ +/gm," ").split([" "]))
export var planet_constants = {}
for(let i = 0; i < units.length;i+=2){
    var body = units[i][0];
    var t1 = units[i].slice(1).map(v=>parseFloat(v));
    var t2 = units[i+1].slice(1).map(v=>parseFloat(v));
    planet_constants[body] = {
        axis:{
            initial:t1[0],
            delta:t2[0]
        },
        eccentricity:{
            initial:t1[1],
            delta:t2[1]
        },
        inclination:{
            initial:t1[2]/180*Math.PI,
            delta:t2[2]/180*Math.PI
        },
        mean_longitude:{
            initial:t1[3]/180*Math.PI,
            delta:t2[3]/180*Math.PI
        },
        longitude_perihelion:{
            initial:t1[4]/180*Math.PI,
            delta:t2[4]/180*Math.PI
        },
        longitude_ascending:{
            initial:t1[5]/180*Math.PI,
            delta:t2[5]/180*Math.PI
        }
    }
}

export const planet_configs = {
  "Sun":      {emissive: 200, color:"#ffff00", s_scalar: 1,  size: 7e8,   texture: "2k_sun.jpg",               mass: 1.989e30, position: [1,1,1]},
  "Mercury":  {color:"#e4eef0", s_scalar: 1, size: 2.4e6, texture: "2k_mercury.jpg",           mass: 3.285e23, },
  "Venus":    {color:"#fffeab", s_scalar: 1, size: 6e6,   texture: "2k_venus_atmosphere.jpg",  mass: 4.867e24 },
  "Earth":    {color:"#528eff", s_scalar: 1, size: 6.4e6, texture: "2k_earth_daymap.jpg",      mass: 5.97219e24 },
  "Mars":     {color:"#f25d00", s_scalar: 1, size: 3.4e6, texture: "2k_mars.jpg",              mass: 6.39e23 },
  "Jupiter":  {color:"#ffdc6b", s_scalar: 1, size: 7e7,   texture: "2k_jupiter.jpg",           mass: 1.898e27 },
  "Saturn":   {color:"#f4fa9d", s_scalar: 1, size: 6e7,   texture: "2k_saturn.jpg",            mass: 5.683e26 },
  "Uranus":   {color:"#787cff", s_scalar: 1, size: 2.5e7, texture: "2k_uranus.jpg",            mass: 8.681e25 },
  "Neptune":  {color:"#bfe3ff", s_scalar: 1, size: 2.5e7, texture: "2k_neptune.jpg",           mass: 1.024e26 },
}

export const AU = 149597870700;
export const Inv_AU = 1/AU;
export const G = 6.67430e-11;
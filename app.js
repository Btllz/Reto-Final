require('dotenv').config();
const path = require('path');
const JWT = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;
const DB = process.env.DB;
const JWT_SECRET = process.env.JWT_SECRET;
const mongoose = require('mongoose');
const { type } = require('os');
const bcryptjs = require('bcryptjs');

app.use(express.josn());
app.use(express.static(path.join(__dirname, 'public')));

const usuariosSchema = new mongoose.Schema({
    correo: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    rol: {type: String, enum: ['solicitante', 'admin'], default: 'usuario'}
});

const usuario = mongoose.model ('usuario', usuariosSchema);

const materialSchema = new mongoose.Schema({
    nombre: {type: String, required: true},
    lote: {type: String, required: true},
    fechaCaducidad: {type: Date, required: true},
    cantidadDisponible: {type: Number, required: true}
});

const material = new mongoose.model('material', materialSchema);

//---------------------------------------------------------------------------------

async function cifrarPassword(password){
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

async function datosValidos(passwordEscrita, passwordGuardada) {
    return await bcrypt.compare(passwordEscrita, passwordGuardada);
}

function verificartoken(req, res, next) {
    const cabecera = req.headers['authorization'];
    if(!cabecera) return res.status(401).json({error: 'Falta el token'});

    const token = cabecera.split(' ')[1];

    try {
        const datos = JWT.verify(token, JWT_SECRET);
        req.usuario = datos;
        next();
    } catch (error){
        console.log(error.message);
        return res.status(401).josn({errror: 'Token expirado o inválido'});
    }
}

function Admin (req, res, next) {
    if(req.usuario.rol !== 'admin'){
        return res.status(403).json({error: 'Se necesita rol de administrador'});
    }
    next();
}